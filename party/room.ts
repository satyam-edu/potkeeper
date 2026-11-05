import { Server, type Connection, type WSMessage } from 'partyserver';
import { createRoom, reduce, type Action } from '../shared/engine';
import { verifyJwt } from '../shared/jwt';
import { toAction } from '../shared/messages';
import { simplifyDebts } from '../shared/settle';
import { SAVE_KEY, loadSaved, makeSaved, shouldSave, type SaveType } from './persist';
import { MAX_ATTEMPTS, backoffMs, buildPayload, postSettle, type SettlePayload } from './settleClient';
import type { ClientMessage, ErrorCode, RoomState, ServerMessage } from '../shared/types';

const MAX_MESSAGE_BYTES = 2048;
const MAX_RESTORE_BYTES = 32768; // a Restore carries the whole round log, so it is the one message allowed to be big
const NAME_MAX = 24;

// Room state lives in RAM: zero DB access during a session. It is also copied to this room's own Cloudflare storage about once a
// finished round (see persist.ts), so a restart or wipe brings the room back at its last finished round instead of losing the game.
export class Room extends Server<Cloudflare.Env> {
  state: RoomState | null = null;
  users = new Map<string, string>(); // connection id → userId
  saveStatus?: 'saved' | 'failed'; // told to anyone who joins after End Game
  startedAt?: string; // when the first round began (RAM only; only feeds the history record)

  /** Runs each time this room's memory starts empty (a new room, or one that was restarted or wiped): load its saved game if it has one. */
  async onStart() {
    const raw = await this.ctx.storage.get(SAVE_KEY);
    if (raw === undefined) return console.log(`room ${this.name} started with empty memory`);
    const r = loadSaved(raw, Date.now());
    if (!r.ok) {
      console.warn(`room ${this.name} dropped its saved game: ${r.reason}`);
      return this.ctx.storage.delete(SAVE_KEY).catch((e) => console.error(`room ${this.name} could not drop its saved game`, e));
    }
    this.state = r.state;
    this.startedAt = r.startedAt;
    console.log(`room ${this.name} came back from its saved game at round ${r.state.roundNumber}`);
  }

  /** Copy the room to storage without making anyone wait for it; a failed save is logged and the game carries on from memory. */
  private save(prev: RoomState | null, next: RoomState, type: SaveType) {
    if (!shouldSave(prev, next, type)) return;
    this.ctx.storage.put(SAVE_KEY, makeSaved(next, this.startedAt, Date.now()), { allowUnconfirmed: true })
      .catch((e) => console.error(`room ${this.name} could not save the game`, e));
  }

  /** The game is over (its result is saved to the database separately): forget the room copy so it can't come back. */
  private forget() {
    this.ctx.storage.delete(SAVE_KEY).catch((e) => console.error(`room ${this.name} could not delete its saved game`, e));
  }

  onMessage(sender: Connection, raw: WSMessage) {
    if (typeof raw !== 'string' || raw.length > MAX_RESTORE_BYTES) return this.fail(sender, 'BAD_MESSAGE');
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return this.fail(sender, 'BAD_MESSAGE');
    }
    if (!msg || typeof msg.t !== 'string' || (msg.t !== 'RESTORE' && raw.length > MAX_MESSAGE_BYTES)) return this.fail(sender, 'BAD_MESSAGE');
    return msg.t === 'JOIN' ? this.join(msg, sender) : this.dispatch(msg, sender);
  }

  onClose(conn: Connection) {
    const userId = this.users.get(conn.id);
    this.users.delete(conn.id);
    // Only mark offline when the user's last socket is gone (multi-tab / quick reconnect).
    if (!userId || !this.state || [...this.users.values()].includes(userId)) return;
    this.commit({ type: 'SET_CONNECTED', connected: false }, userId);
  }

  private async join(msg: Extract<ClientMessage, { t: 'JOIN' }>, conn: Connection) {
    const secret = this.env.JWT_SECRET;
    const claims = typeof secret === 'string' ? await verifyJwt(String(msg.token), secret) : null;
    if (!claims) return this.fail(conn, 'BAD_TOKEN');
    const name = String(msg.name ?? claims.name).trim().slice(0, NAME_MAX) || claims.name;

    if (msg.create) {
      if (this.state) return this.fail(conn, 'ROOM_EXISTS'); // 4-digit code collision: client picks another
      const baseBet = msg.create.baseBet;
      if (!Number.isInteger(baseBet) || baseBet < 1) return this.fail(conn, 'BAD_MESSAGE');
      const made = reduce(createRoom(this.name, claims.sub, name, baseBet), { type: 'JOIN', name, avatarUrl: msg.avatarUrl }, claims.sub); // the host's seat, with their photo
      if (!made.ok) return this.fail(conn, made.error);
      this.state = made.state;
      this.save(null, made.state, 'CREATE');
      this.users.set(conn.id, claims.sub);
      return this.broadcastState();
    }
    if (!this.state) {
      console.warn(`room ${this.name} not found for a join`);
      return this.fail(conn, 'ROOM_NOT_FOUND');
    }
    const r = reduce(this.state, { type: 'JOIN', name, avatarUrl: msg.avatarUrl }, claims.sub);
    if (!r.ok) return this.fail(conn, r.error);
    this.save(this.state, r.state, 'JOIN');
    this.state = r.state;
    this.users.set(conn.id, claims.sub);
    this.broadcastState();
    if (this.saveStatus) conn.send(JSON.stringify({ t: 'SAVE', status: this.saveStatus } satisfies ServerMessage));
  }

  private dispatch(msg: ClientMessage, conn: Connection) {
    const userId = this.users.get(conn.id);
    if (!userId || !this.state) return this.fail(conn, 'NOT_JOINED');
    const action = toAction(msg, crypto.randomUUID());
    if (!action) return this.fail(conn, 'BAD_MESSAGE');
    const resuming = action.type === 'REOPEN_GAME' || action.type === 'NEW_GAME';
    // The next game must not overwrite a result that is still waiting to be saved.
    if (resuming && this.state.hostId === userId && this.state.phase === 'ENDED' && this.saveStatus !== 'saved') return this.fail(conn, 'NOT_SAVED');
    const prev = this.state;
    const r = this.commit(action, userId);
    if (!r.ok) return this.fail(conn, r.error);
    if (resuming) {
      this.saveStatus = undefined;
      this.startedAt = undefined;
    }
    if (action.type === 'START_ROUND' || action.type === 'RESTORE') this.startedAt ??= new Date().toISOString();
    this.save(prev, r.state, action.type); // after startedAt is settled, so the copy carries it
    if (action.type === 'END_GAME') {
      this.forget();
      this.broadcastSettlement();
      return this.saveGame(buildPayload(this.state!, this.startedAt));
    }
  }

  /** The room's only DB touchpoint. Persist first so a restart or an API outage can't lose the result. */
  private async saveGame(payload: SettlePayload) {
    await this.ctx.storage.put('pending', { payload, attempts: 0 });
    await this.trySettle();
  }

  /** Alarm = retry after a failed attempt (also wakes a room that was evicted in between). */
  onAlarm() {
    return this.trySettle();
  }

  private async trySettle() {
    const pending = await this.ctx.storage.get<{ payload: SettlePayload; attempts: number }>('pending');
    if (!pending) return;
    const { SETTLE_URL: url, SETTLE_SECRET: secret } = this.env;
    if (typeof url !== 'string' || typeof secret !== 'string') {
      return console.error('settle: SETTLE_URL / SETTLE_SECRET not set, result kept in storage and not saved', pending.payload.sessionId);
    }
    const outcome = await postSettle(pending.payload, url, secret);
    if (outcome === 'saved') {
      await this.ctx.storage.delete('pending');
      return this.announceSave('saved');
    }
    if (outcome === 'rejected' || pending.attempts + 1 >= MAX_ATTEMPTS) {
      this.announceSave('failed');
      return console.error(`settle: giving up (${outcome})`, pending.payload.sessionId); // payload stays in storage for manual replay
    }
    await this.ctx.storage.put('pending', { ...pending, attempts: pending.attempts + 1 });
    await this.ctx.storage.setAlarm(Date.now() + backoffMs(pending.attempts));
  }

  /** Apply an action through the shared engine; broadcast on success. */
  private commit(action: Action, userId: string) {
    const r = reduce(this.state!, action, userId);
    if (r.ok) {
      this.state = r.state;
      this.broadcastState();
    }
    return r;
  }

  private broadcastState() {
    if (this.state) this.broadcast(JSON.stringify({ t: 'STATE', state: this.state } satisfies ServerMessage));
  }

  private broadcastSettlement() {
    const s = this.state!;
    const nets = Object.fromEntries(s.players.map((p) => [p.userId, p.sessionBalance]));
    const msg: ServerMessage = {
      t: 'SETTLEMENT',
      leaderboard: s.players.map((p) => ({ userId: p.userId, name: p.name, net: p.sessionBalance })).sort((a, b) => b.net - a.net),
      payments: simplifyDebts(nets),
    };
    this.broadcast(JSON.stringify(msg));
  }

  private announceSave(status: 'saved' | 'failed') {
    this.saveStatus = status;
    this.broadcast(JSON.stringify({ t: 'SAVE', status } satisfies ServerMessage));
  }

  private fail(conn: Connection, code: ErrorCode) {
    conn.send(JSON.stringify({ t: 'ERROR', code } satisfies ServerMessage));
  }
}
