import type { Action } from './engine';
import type { ClientMessage } from './types';

/** Wire message → engine action. Used by the room server and by the client for optimistic updates. */
export function toAction(msg: ClientMessage, sessionId: string): Action | null {
  switch (msg.t) {
    case 'START_ROUND': return { type: 'START_ROUND', sessionId };
    case 'BET': return { type: 'BET' };
    case 'PACK': return { type: 'PACK' };
    case 'SHOW': return { type: 'SHOW' };
    case 'CANCEL_SHOW': return { type: 'CANCEL_SHOW' };
    case 'UNDO': return { type: 'UNDO' };
    case 'END_GAME': return { type: 'END_GAME' };
    case 'REOPEN_GAME': return { type: 'REOPEN_GAME' };
    case 'NEW_GAME': return { type: 'NEW_GAME' };
    case 'AWARD_POT': return Array.isArray(msg.winnerIds) ? { type: 'AWARD_POT', winnerIds: msg.winnerIds.map(String) } : null;
    case 'TRANSFER_HOST': return { type: 'TRANSFER_HOST', toUserId: String(msg.toUserId) };
    case 'REORDER': return Array.isArray(msg.order) ? { type: 'REORDER', order: msg.order.map(String) } : null;
    case 'SET_BASE_BET': return { type: 'SET_BASE_BET', baseBet: msg.baseBet };
    case 'REMOVE_PLAYER': return { type: 'REMOVE_PLAYER', userId: String(msg.userId) };
    case 'REQUEST_REJOIN': return { type: 'REQUEST_REJOIN' };
    case 'ANSWER_REJOIN': return { type: 'ANSWER_REJOIN', userId: String(msg.userId), allow: msg.allow === true };
    case 'RESTORE':
      if (!Array.isArray(msg.seats) || !Array.isArray(msg.log)) return null;
      return {
        type: 'RESTORE', sessionId, round: msg.round, opener: String(msg.opener), currentBet: msg.currentBet, log: msg.log,
        ...(msg.turn !== undefined && { turn: String(msg.turn) }),
        seats: msg.seats.map((x) => ({ userId: String(x?.userId), total: x?.total, roundBet: x?.roundBet, packed: x?.packed === true })),
      };
    default: return null;
  }
}
