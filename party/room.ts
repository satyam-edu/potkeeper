import type * as Party from 'partykit/server';
import { createRoom, reduce, type Action } from '../shared/engine';
import { verifyJwt } from '../shared/jwt';
import { simplifyDebts } from '../shared/settle';
import type { ClientMessage, ErrorCode, RoomState, ServerMessage } from '../shared/types';

const MAX_MESSAGE_BYTES = 2048;
const NAME_MAX = 24;

// Room state lives in RAM only — zero DB access during a session.
export default class Room implements Party.Server {
  state: RoomState | null = null;
  users = new Map<string, string>(); // connection id → userId

  constructor(readonly room: Party.Room) {}

  onMessage(raw: string | ArrayBuffer, sender: Party.Connection) {
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

  onClose(conn: Party.Connection) {
    const userId = this.users.get(conn.id);
    this.users.delete(conn.id);
    // Only mark offline when the user's last socket is gone (multi-tab / quick reconnect).
    if (!userId || !this.state || [...this.users.values()].includes(userId)) return;
    this.commit({ type: 'SET_CONNECTED', connected: false }, userId);
  }

  private async join(msg: Extract<ClientMessage, { t: 'JOIN' }>, conn: Party.Connection) {
    const secret = this.room.env.JWT_SECRET;
    const claims = typeof secret === 'string' ? await verifyJwt(String(msg.token), secret) : null;
    if (!claims) return this.fail(conn, 'BAD_TOKEN');
    const name = String(msg.name ?? claims.name).trim().slice(0, NAME_MAX) || claims.name;

    if (msg.create) {
      if (this.state) return this.fail(conn, 'ROOM_EXISTS'); // 4-digit code collision: client picks another
      const baseBet = msg.create.baseBet;
      if (!Number.isInteger(baseBet) || baseBet < 1) return this.fail(conn, 'BAD_MESSAGE');
      this.state = createRoom(this.room.id, claims.sub, name, baseBet);
      this.users.set(conn.id, claims.sub);
      return this.broadcastState();
    }
    if (!this.state) return this.fail(conn, 'ROOM_NOT_FOUND');
    const r = reduce(this.state, { type: 'JOIN', name }, claims.sub);
    if (!r.ok) return this.fail(conn, r.error);
    this.state = r.state;
    this.users.set(conn.id, claims.sub);
    this.broadcastState();
  }

  private dispatch(msg: ClientMessage, conn: Party.Connection) {
    const userId = this.users.get(conn.id);
    if (!userId || !this.state) return this.fail(conn, 'NOT_JOINED');
    const action = this.toAction(msg);
    if (!action) return this.fail(conn, 'BAD_MESSAGE');
    const r = this.commit(action, userId);
    if (!r.ok) return this.fail(conn, r.error);
    if (action.type === 'END_GAME') this.broadcastSettlement();
  }

  private toAction(msg: ClientMessage): Action | null {
    switch (msg.t) {
      case 'START_ROUND': return { type: 'START_ROUND', sessionId: crypto.randomUUID() };
      case 'BET': return { type: 'BET' };
      case 'PACK': return { type: 'PACK' };
      case 'UNDO': return { type: 'UNDO' };
      case 'END_GAME': return { type: 'END_GAME' };
      case 'AWARD_POT': return Array.isArray(msg.winnerIds) ? { type: 'AWARD_POT', winnerIds: msg.winnerIds.map(String) } : null;
      case 'TRANSFER_HOST': return { type: 'TRANSFER_HOST', toUserId: String(msg.toUserId) };
      case 'REORDER': return Array.isArray(msg.order) ? { type: 'REORDER', order: msg.order.map(String) } : null;
      case 'SET_BASE_BET': return { type: 'SET_BASE_BET', baseBet: msg.baseBet };
      case 'REMOVE_PLAYER': return { type: 'REMOVE_PLAYER', userId: String(msg.userId) };
      default: return null;
    }
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
    if (this.state) this.room.broadcast(JSON.stringify({ t: 'STATE', state: this.state } satisfies ServerMessage));
  }

  private broadcastSettlement() {
    const s = this.state!;
    const nets = Object.fromEntries(s.players.map((p) => [p.userId, p.sessionBalance]));
    const msg: ServerMessage = {
      t: 'SETTLEMENT',
      leaderboard: s.players.map((p) => ({ userId: p.userId, name: p.name, net: p.sessionBalance })).sort((a, b) => b.net - a.net),
      payments: simplifyDebts(nets),
    };
    this.room.broadcast(JSON.stringify(msg));
    // TODO(P4-03): POST the signed payload to /api/games/settle
  }

  private fail(conn: Party.Connection, code: ErrorCode) {
    conn.send(JSON.stringify({ t: 'ERROR', code } satisfies ServerMessage));
  }
}
