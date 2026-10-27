import { Server, type Connection, type WSMessage } from 'partyserver';
import { createRoom, reduce, type Action } from '../shared/engine';
import { verifyJwt } from '../shared/jwt';
import { toAction } from '../shared/messages';
import { simplifyDebts } from '../shared/settle';
import { MAX_ATTEMPTS, backoffMs, buildPayload, postSettle, type SettlePayload } from './settleClient';
import type { ClientMessage, ErrorCode, RoomState, ServerMessage } from '../shared/types';

const MAX_MESSAGE_BYTES = 2048;
const NAME_MAX = 24;

// Room state lives in RAM only — zero DB access during a session.
export class Room extends Server<Cloudflare.Env> {
  state: RoomState | null = null;
  users = new Map<string, string>(); // connection id → userId
  saveStatus?: 'saved' | 'failed'; // told to anyone who joins after End Game
  startedAt?: string; // when the first round began (RAM only; only feeds the history record)

  onMessage(sender: Connection, raw: WSMessage) {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return this.fail(sender, 'BAD_MESSAGE');
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return this.fail(sender, 'BAD_MESSAGE');
    }
    if (!msg || typeof msg.t !== 'string') return this.fail(sender, 'BAD_MESSAGE');
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
      this.state = createRoom(this.name, claims.sub, name, baseBet);
      this.users.set(conn.id, claims.sub);
      return this.broadcastState();
    }
    if (!this.state) return this.fail(conn, 'ROOM_NOT_FOUND');
    const r = reduce(this.state, { type: 'JOIN', name }, claims.sub);
    if (!r.ok) return this.fail(conn, r.error);
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
    const r = this.commit(action, userId);
    if (!r.ok) return this.fail(conn, r.error);
    if (action.type === 'START_ROUND') this.startedAt ??= new Date().toISOString();
    if (action.type === 'END_GAME') {
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
