<p align="center">
  <img src="public/logo.png" alt="PotKeeper logo" width="140" />
</p>

<h1 align="center">PotKeeper</h1>

<p align="center"><b>3 Patti without chips. Just your phone.</b></p>

PotKeeper is a live digital pot and ledger for 3 Patti games played on a real table. Friends join a room with a code or QR, tap Bet, Pack or Show on their own phones, and the app keeps the pot and every player's wins and losses in rupees. When the game ends, the result is saved to each player's wallet and history.

Live at [potkeeper.tech](https://potkeeper.tech).

> **Note:** PotKeeper is a fun project built for personal use and for playing with friends. It is not a commercial product, it does not handle real payments, and it is not intended for public or large scale use.

## What it does

- **Rooms:** create a room, share the 4 digit code or QR, 2 to 10 players per room. Players who join mid game wait for the next round.
- **Betting:** each Bet raises the stake by exactly the base bet and the bettor pays up to the new level. Pack folds a player out of the round. Show opens a winner popup on every screen.
- **Pot and ties:** the pot is split by whole rupees, and any remainder carries to the next round.
- **Host tools:** Undo (last 3 actions), transfer host, cash out a player, End Game.
- **After the game:** the host can start a new game in the same room or reopen the finished one and keep playing.
- **Wallet and history:** a lifetime wallet and a game by game history, per account. Guest login, with optional Google sign in to keep the wallet across devices.
- **Table comfort:** the screen stays awake, the layout fits one screen on a phone, voice calls for Bet, Pack, Show and new rounds (with a mute switch), and a Back button warning so nobody leaves a game by accident.

All money is whole rupees (integers) and every action keeps the table balanced: wins, losses, pot and carry always add up to zero.

## How a round works

1. Every active player pays the base bet into the pot.
2. On their turn a player can **Bet** (raise the stake by the base bet), **Pack** (fold), or **Show**.
3. On a showdown everyone still in first matches the current bet, then the winner (or winners, for a tie) is chosen and takes the pot.
4. If everyone else packs, the last player wins the pot automatically.
5. The host starts the next round, or ends the game and the results are saved.

Hand ranking, high to low: Trail, Pure Sequence, Sequence, Color, Pair, High Card.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Live room server | PartyServer on Cloudflare Workers (room state is kept in memory during a game) |
| API | Vercel serverless functions in `/api` |
| Database | MongoDB Atlas with Mongoose (touched once per game, when it is saved) |
| Auth | Guest login and Google sign in, JWT |
| Realtime client | `partysocket` |

The game rules live in one shared module, `shared/engine.ts`, which both the room server and the browser import, so the server is the authority and the app can still react instantly.

## Project structure

```
api/       Vercel serverless API (auth, wallet, history, saving finished games)
party/     Cloudflare Worker room server
shared/    Game engine, message types and helpers used by both sides
src/       React app (pages, components, hooks)
public/    Static files, including the voice clips
scripts/   Small helper scripts
```

## Getting started

Requirements: Node.js 20 or newer, a MongoDB Atlas database, and a Google OAuth client ID (optional, only for Google sign in).

```bash
npm install
cp .env.example .env     # then fill in the values
```

Create a `.dev.vars` file for the room server with the same `JWT_SECRET` and `SETTLE_SECRET` as `.env`, and `SETTLE_URL=http://localhost:5173/api/games/settle`.

Run two terminals:

```bash
npm run dev          # app and API on http://localhost:5173
npm run dev:party    # room server on port 1999
```

To try it on a phone on the same Wi‑Fi, run `npm run dev -- --host` and `npm run dev:party -- --ip 0.0.0.0`, then open the address Vite prints.

### Environment variables

| Name | Used by | Purpose |
|---|---|---|
| `JWT_SECRET` | API and room server | Signs and checks login tokens (same value in both) |
| `SETTLE_SECRET` | API and room server | Signs the request that saves a finished game (same value in both) |
| `SETTLE_URL` | Room server | Where the room server sends finished games |
| `MONGODB_URI` | API | MongoDB connection string |
| `GOOGLE_CLIENT_ID` | API | Google sign in |
| `VITE_GOOGLE_CLIENT_ID` | App | Google sign in button |
| `VITE_ROOM_HOST` | App | Room server host in production (in development it follows the page address) |

Never commit real secrets. `.env` and `.dev.vars` are ignored by git.

## Scripts

```bash
npm run dev         # start the app and API
npm run dev:party   # start the room server
npm run typecheck   # TypeScript checks for the app and the Worker
npm test            # unit tests (API tests that need MongoDB are skipped without a connection)
npm run build       # typecheck and production build
```

## Deployment

- **App and API:** Vercel, deployed from the `main` branch.
- **Room server:** Cloudflare Workers, deployed with `npx wrangler deploy`. Production secrets are set with `npx wrangler secret put`.
- **Database:** MongoDB Atlas.

Everything runs on free tiers.
