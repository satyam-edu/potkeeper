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

export const User = mongoose.models.User ?? mongoose.model('User', UserSchema);
