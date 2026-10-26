import mongoose from 'mongoose';

// Reuse one connection across warm serverless invocations (and dev-server reloads).
const g = globalThis as unknown as { __pkMongo?: Promise<typeof mongoose> };

export function connectDb(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  g.__pkMongo ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 });
  return g.__pkMongo;
}
