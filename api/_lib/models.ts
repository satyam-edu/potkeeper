import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, trim: true, maxlength: 24 },
    avatarUrl: String,
    nameChangedAt: Date, // last time a Google user renamed themselves (one change per NAME_COOLDOWN_DAYS)
    isGuest: { type: Boolean, default: true },
    walletBalance: { type: Number, default: 0, validate: Number.isInteger }, // lifetime net ₹
    mergedInto: { type: Schema.Types.ObjectId, ref: 'User' }, // tombstone after a guest→Google merge
  },
  { timestamps: true },
);

// `models.X ??` keeps one model across dev-server reloads; the cast keeps query typing simple.
export const User = (mongoose.models.User ?? mongoose.model('User', UserSchema)) as mongoose.Model<any>;

const GameSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true }, // idempotency key from the room server
    roomCode: String,
    baseBet: { type: Number, required: true },
    rounds: { type: Number, required: true },
    hostId: { type: Schema.Types.ObjectId, ref: 'User' }, // who hosted the game; only they may open a settle room (games saved before this was recorded have none: any player may)
    status: { type: String, enum: ['PENDING', 'SETTLED'], default: 'PENDING' }, // missing on old games = PENDING
    settledAt: Date,
    settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement' },
    startedAt: Date,
    endedAt: { type: Date, required: true },
    players: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
        name: String, // snapshot at game time
        net: { type: Number, validate: Number.isInteger },
        cashedOut: Boolean,
      },
    ],
  },
  { timestamps: true },
);
GameSessionSchema.index({ 'players.userId': 1, endedAt: -1 });

export const GameSession = (mongoose.models.GameSession ?? mongoose.model('GameSession', GameSessionSchema)) as mongoose.Model<any>;

// One settle room per attempt. A SETTLED one stays forever as the receipt (who clicked when, what each wallet changed by).
const SettlementSchema = new Schema(
  {
    gameId: { type: Schema.Types.ObjectId, ref: 'GameSession', required: true },
    status: { type: String, enum: ['OPEN', 'SETTLED', 'CANCELLED', 'EXPIRED'], default: 'OPEN' },
    startedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    settledAt: Date,
    closedAt: Date, // cancelled or expired
    // Only players with a non zero net: someone at ₹0 has nothing to confirm.
    players: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        name: String,
        net: { type: Number, validate: Number.isInteger },
        readyAt: Date, // the click; unset until they click
        walletDelta: Number, // what settling added to their wallet (= −net), set when it settles
      },
    ],
    payments: [{ _id: false, from: Schema.Types.ObjectId, to: Schema.Types.ObjectId, amount: Number }], // who pays whom, from simplifyDebts at the start
  },
  { timestamps: true },
);
// A game has at most one OPEN room at a time (also guards two hosts tapping Settle together).
SettlementSchema.index({ gameId: 1 }, { unique: true, partialFilterExpression: { status: 'OPEN' } });
SettlementSchema.index({ gameId: 1, startedAt: -1 });
SettlementSchema.index({ 'players.userId': 1, status: 1 });

export const Settlement = (mongoose.models.Settlement ?? mongoose.model('Settlement', SettlementSchema)) as mongoose.Model<any>;
