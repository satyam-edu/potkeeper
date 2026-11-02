import { signed } from '../lib/format';

const FACES = [['♠', 'text-ink'], ['♥', 'text-danger'], ['♦', 'text-danger']] as const;

/** Shown while the balance loads: three cards fanned out, turning over one after another. */
function DealingCards() {
  return (
    <span role="status" aria-label="Loading your balance" className="flex h-[3.75rem] items-center justify-center">
      {FACES.map(([suit, color], i) => (
        <span key={suit} style={{ transform: `rotate(${(i - 1) * 14}deg)` }} className="-mx-1 [perspective:400px]">
          <span className="card-flip relative block h-14 w-10" style={{ animationDelay: `${i * 0.18}s` }}>
            <span className="absolute inset-0 rounded-md border-2 border-white bg-[repeating-linear-gradient(45deg,#8e1b1b_0_3px,#b02a2a_3px_6px)] [backface-visibility:hidden]" />
            <span className={`absolute inset-0 flex items-center justify-center rounded-md border-2 border-ink/20 bg-paper text-3xl [backface-visibility:hidden] [transform:rotateY(180deg)] ${color}`}>{suit}</span>
          </span>
        </span>
      ))}
    </span>
  );
}

const cell = 'flex-1 rounded-2xl border border-dashed border-ink/30 px-3 py-2 text-center';

/** What is still to settle: lime when you're owed, red when you owe. A game drops out once it is settled. Guests get a nudge to sync Google. */
export function WalletCard({ balance, isGuest, onSync }: { balance: number | null; isGuest: boolean; onSync: () => void }) {
  const down = balance !== null && balance < 0;
  return (
    <section aria-label="To settle" className="flex flex-col overflow-hidden rounded-[28px]">
      <div className={`px-5 pb-7 pt-5 text-center ${down ? 'bg-danger text-white' : 'bg-neon text-ink'}`}>
        <p className="text-xs font-bold tracking-widest opacity-70">TO SETTLE</p>
        <p className="amount mt-1 text-6xl leading-none tracking-tight tabular-nums">{balance === null ? <DealingCards /> : signed(balance)}</p>
      </div>
      <span aria-hidden="true" className="amount relative z-10 -my-5 mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-ink text-lg text-neon">₹</span>
      <div className="flex gap-3 bg-paper p-3 pt-7 text-ink">
        <div className={cell}>
          <p className="text-[10px] font-bold tracking-widest text-ink/50">ACCOUNT</p>
          <p className="display text-xl font-bold leading-tight">{isGuest ? 'Guest' : 'Google'}</p>
        </div>
        {isGuest ? (
          <button onClick={onSync} className={`${cell} active:bg-ink/5`}>
            <span className="block text-[10px] font-bold tracking-widest text-ink/50">KEEP IT SAFE</span>
            <span className="display block text-xl font-bold leading-tight">Sync Google</span>
          </button>
        ) : (
          <div className={cell}>
            <p className="text-[10px] font-bold tracking-widest text-ink/50">STATUS</p>
            <p className="display text-xl font-bold leading-tight">Synced</p>
          </div>
        )}
      </div>
    </section>
  );
}
