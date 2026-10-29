// One off cleanup: remove an account's game history except one day (days are India time, IST).
// Dry run by default, nothing changes until you add --yes.
//   node --env-file=.env scripts/clear-history.mjs --email you@gmail.com --keep 2026-10-30
//   node --env-file=.env scripts/clear-history.mjs --email you@gmail.com --keep 2026-10-30 --yes
// Options:
//   --delete-games  delete the whole game record (it also vanishes from the OTHER players' history).
//                   Without it only this account's row is taken out of each game.
//   --fix-wallet    set the wallet to the total of the games that stay. Without it the wallet is left as is.
import mongoose from 'mongoose';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (n) => args.includes(`--${n}`);
const email = opt('email');
const keep = opt('keep');
if (!email || !/^\d{4}-\d{2}-\d{2}$/.test(keep ?? '') || !process.env.MONGODB_URI) {
  console.error('Usage: node --env-file=.env scripts/clear-history.mjs --email <email> --keep YYYY-MM-DD [--yes] [--delete-games] [--fix-wallet]');
  process.exit(1);
}
const [y, m, d] = keep.split('-').map(Number);
const from = new Date(Date.UTC(y, m - 1, d) - 5.5 * 3600e3); // 00:00 IST
const to = new Date(from.getTime() + 24 * 3600e3);
const ist = (dt) => new Date(dt.getTime() + 5.5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
const db = mongoose.connection.db;
try {
  // Emails are matched ignoring upper and lower case.
  const user = await db.collection('users').findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
  if (!user) {
    const all = await db.collection('users').find({}, { projection: { name: 1, email: 1, isGuest: 1, walletBalance: 1 } }).limit(30).toArray();
    console.error(`No account with email ${email} in database "${db.databaseName}" (${all.length} accounts shown, max 30).`);
    console.error('If your account is not in this list, MONGODB_URI in .env points at a different database than the live site.');
    for (const u of all) console.error(`  ${u.name}  ${u.email ?? '(guest, no email)'}  wallet ${u.walletBalance}`);
    process.exitCode = 1;
    await mongoose.disconnect();
    process.exit(1);
  }
  const games = db.collection('gamesessions');
  const mine = await games.find({ 'players.userId': user._id }).sort({ endedAt: 1 }).toArray();
  const net = (g) => g.players.find((p) => String(p.userId) === String(user._id))?.net ?? 0;
  const drop = mine.filter((g) => g.endedAt < from || g.endedAt >= to);
  const stay = mine.filter((g) => !(g.endedAt < from || g.endedAt >= to));
  const walletAfter = stay.reduce((n, g) => n + net(g), 0);

  console.log(`Account ${user.name} (${email}), wallet now ${user.walletBalance}`);
  console.log(`Games: ${mine.length} total, keeping ${stay.length} from ${keep} IST, removing ${drop.length}`);
  for (const g of drop) console.log(`  remove  ${ist(g.endedAt)} IST  room ${g.roomCode}  ${g.players.length} players  net ${net(g)}`);
  for (const g of stay) console.log(`  keep    ${ist(g.endedAt)} IST  room ${g.roomCode}  ${g.players.length} players  net ${net(g)}`);
  console.log(`Wallet would be ${walletAfter} if recalculated from the games that stay (${has('fix-wallet') ? 'will be applied' : 'NOT applied, add --fix-wallet'})`);
  console.log(has('delete-games') ? 'Mode: delete whole game records' : 'Mode: remove only this account from each game');

  if (!has('yes')) {
    console.log('Dry run only. Nothing was changed. Add --yes to apply.');
  } else if (drop.length) {
    const ids = drop.map((g) => g._id);
    const r = has('delete-games')
      ? await games.deleteMany({ _id: { $in: ids } })
      : await games.updateMany({ _id: { $in: ids } }, { $pull: { players: { userId: user._id } } });
    console.log(`Done: ${r.deletedCount ?? r.modifiedCount} game records changed`);
    if (has('fix-wallet')) {
      await db.collection('users').updateOne({ _id: user._id }, { $set: { walletBalance: walletAfter } });
      console.log(`Wallet set to ${walletAfter}`);
    }
  }
} finally {
  await mongoose.disconnect();
}
