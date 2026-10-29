import { signed } from '../lib/format';

const cell = 'flex-1 rounded-2xl border border-dashed border-ink/30 px-3 py-2 text-center';

/** Lifetime wallet: lime when you're up, red when you're down. Guests get a nudge to sync Google. */
export function WalletCard({ balance, isGuest, onSync }: { balance: number | null; isGuest: boolean; onSync: () => void }) {
  const down = balance !== null && balance < 0;
  return (
    <section aria-label="Lifetime wallet" className="flex flex-col overflow-hidden rounded-[28px]">
      <div className={`px-5 pb-7 pt-5 text-center ${down ? 'bg-danger text-white' : 'bg-neon text-ink'}`}>
        <p className="text-xs font-bold tracking-widest opacity-70">LIFETIME WALLET</p>
        <p className="amount mt-1 text-6xl leading-none tracking-tight tabular-nums">{balance === null ? '…' : signed(balance)}</p>
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
