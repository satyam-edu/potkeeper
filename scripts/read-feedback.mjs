// Read what people sent from the app's Feedback menu, newest first.
//   node --env-file=.env scripts/read-feedback.mjs            (last 20)
//   node --env-file=.env scripts/read-feedback.mjs --type BUG --limit 50
import mongoose from 'mongoose';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Run with: node --env-file=.env scripts/read-feedback.mjs [--type FEATURE|BUG|MESSAGE] [--limit N]');
  process.exit(1);
}
const type = opt('type')?.toUpperCase();
const limit = Math.min(Number(opt('limit')) || 20, 200);
const ist = (dt) => new Date(dt.getTime() + 5.5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
try {
  const rows = await mongoose.connection.db.collection('feedbacks').find(type ? { type } : {}).sort({ createdAt: -1 }).limit(limit).toArray();
  if (!rows.length) console.log('No feedback yet.');
  for (const r of rows) console.log(`\n[${r.type}] ${ist(r.createdAt)} IST  ${r.name} <${r.email}>\n${r.message}`);
} finally {
  await mongoose.disconnect();
}
