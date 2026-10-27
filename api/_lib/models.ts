import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema(
  {
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, trim: true, maxlength: 24 },
    avatarUrl: String,
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
