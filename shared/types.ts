export type Status = 'ACTIVE' | 'PACKED' | 'WAITING';
export type Phase = 'LOBBY' | 'BETTING' | 'BETWEEN_ROUNDS' | 'ENDED';

export interface Player {
  userId: string;
  name: string;
  seat: number; // clockwise order; players[] is kept sorted by seat
  status: Status;
  connected: boolean;
  sessionBalance: number; // integer ₹, may be negative
  roundBet: number; // integer ₹ put in this round (incl. entry); 0 outside BETTING
  cashedOut: boolean; // removed early; balance locked
}

export interface RoomState {
  code: string;
  sessionId: string; // minted at first START_ROUND; settle idempotency key
  hostId: string;
  baseBet: number;
  phase: Phase;
  players: Player[];
  pot: number;
  carryOverPot: number;
  currentTurnIndex: number; // index into players[]; -1 when no round is running
  startIndex: number; // index of the player who opened the last round; -1 before the first
  roundNumber: number;
  historyStack: Snapshot[]; // last UNDO_DEPTH pre-action snapshots
}
export type Snapshot = Omit<RoomState, 'historyStack'>;

// Client → server messages (the `t` discriminator is the wire format).
export type ClientMessage =
  | { t: 'JOIN'; token: string; name: string; create?: { baseBet: number } }
  | { t: 'START_ROUND' }
  | { t: 'BET' }
  | { t: 'PACK' }
  | { t: 'AWARD_POT'; winnerIds: string[] }
  | { t: 'TRANSFER_HOST'; toUserId: string }
  | { t: 'UNDO' }
  | { t: 'END_GAME' }
  | { t: 'REORDER'; order: string[] }
  | { t: 'SET_BASE_BET'; baseBet: number }
  | { t: 'REMOVE_PLAYER'; userId: string };

// Server → client messages.
export type ServerMessage =
  | { t: 'STATE'; state: RoomState }
  | { t: 'SETTLEMENT'; leaderboard: { userId: string; name: string; net: number }[]; payments: Payment[] }
  | { t: 'ERROR'; code: ErrorCode; message?: string };

export interface Payment {
  from: string;
  to: string;
  amount: number;
}

export type EngineError =
  | 'NOT_HOST'
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'ROOM_FULL'
  | 'BAD_INPUT'
  | 'NOT_FOUND'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOTHING_TO_UNDO'
  | 'NOT_ACTIVE'
  | 'NOT_ALLOWED'
  | 'REMOVED'
  | 'INVARIANT';

export type ErrorCode = EngineError | 'BAD_TOKEN' | 'BAD_MESSAGE' | 'ROOM_EXISTS' | 'ROOM_NOT_FOUND' | 'NOT_JOINED';
