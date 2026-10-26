// Local smoke test for the PartyKit room: two clients, create → join → start → bet → latency.
// Run: npx partykit dev --var JWT_SECRET=dev   (other shell)   node scripts/smoke.mjs
import { createHmac } from 'node:crypto';

const SECRET = process.env.JWT_SECRET ?? 'dev';
const HOST = process.env.PARTY_HOST ?? 'localhost:1999';
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const token = (sub, name) => {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, name, exp: Math.floor(Date.now() / 1000) + 600 })}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
};
const room = String(1000 + Math.floor(Math.random() * 9000));

function client(id, name) {
  const ws = new WebSocket(`ws://${HOST}/parties/main/${room}`);
  const c = { ws, last: null, waiters: [] };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    c.last = m;
    c.waiters = c.waiters.filter((w) => !w(m));
  };
  c.open = new Promise((r) => (ws.onopen = r));
  c.send = (m) => ws.send(JSON.stringify(m));
  c.next = (pred) => new Promise((r) => c.waiters.push((m) => (pred(m) ? (r(m), true) : false)));
  c.token = token(id, name);
  return c;
}
const assert = (c, msg) => { if (!c) { console.error('FAIL:', msg); process.exit(1); } };

const a = client('u1', 'Sid'), b = client('u2', 'Ayush');
await Promise.all([a.open, b.open]);
const aState = a.next((m) => m.t === 'STATE');
a.send({ t: 'JOIN', token: a.token, name: 'Sid', create: { baseBet: 5 } });
await aState;
const bState = b.next((m) => m.t === 'STATE' && m.state.players.length === 2);
b.send({ t: 'JOIN', token: b.token, name: 'Ayush' });
await bState;

// collision + bad token
const c = client('u3', 'X'); await c.open;
const e1 = c.next((m) => m.t === 'ERROR');
c.send({ t: 'JOIN', token: c.token, name: 'X', create: { baseBet: 5 } });
assert((await e1).code === 'ROOM_EXISTS', 'create on live room must collide');
const e2 = c.next((m) => m.t === 'ERROR');
c.send({ t: 'JOIN', token: 'garbage', name: 'X' });
assert((await e2).code === 'BAD_TOKEN', 'bad token rejected');

a.send({ t: 'START_ROUND' });
await b.next((m) => m.t === 'STATE' && m.state.phase === 'BETTING');

const t0 = performance.now();
const seen = b.next((m) => m.t === 'STATE' && m.state.pot === 15);
a.send({ t: 'BET' });
const s = (await seen).state;
const ms = performance.now() - t0;
assert(s.players[0].sessionBalance === -10 && s.players[1].sessionBalance === -5, 'balances after BET');
console.log(`OK  BET → other client saw pot ₹${s.pot} in ${ms.toFixed(1)}ms`);

const err = a.next((m) => m.t === 'ERROR');
a.send({ t: 'BET' }); // not a's turn any more
assert((await err).code === 'NOT_YOUR_TURN', 'out-of-turn BET rejected');
console.log('OK  out-of-turn BET rejected');

// reconnect keeps the seat
b.ws.close();
const b2 = client('u2', 'Ayush'); await b2.open;
const back = b2.next((m) => m.t === 'STATE');
b2.send({ t: 'JOIN', token: b2.token, name: 'Ayush' });
const st = (await back).state;
assert(st.players.length === 2 && st.players[1].connected, 'reconnect resumes the seat');
console.log('OK  reconnect resumed the same seat');
process.exit(0);
