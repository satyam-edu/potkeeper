import { signed } from '../lib/format';

/** Lifetime wallet: neon when you're up, red when you're down. Guests get a nudge to sync Google. */
export function WalletCard({ balance, isGuest, onSync }: { balance: number | null; isGuest: boolean; onSync: () => void }) {
  return (
    <section aria-label="Lifetime wallet" className="rounded-[28px] bg-surface p-5 text-center">
      <p className="text-xs font-semibold tracking-widest text-mid">LIFETIME WALLET</p>
      <p className={`display my-1 text-6xl font-bold leading-none tabular-nums ${balance === null ? 'text-mid' : balance < 0 ? 'text-danger' : 'text-neon'}`}>
        {balance === null ? '—' : signed(balance)}
      </p>
      {isGuest && (
        <button onClick={onSync} className="mt-3 rounded-full bg-surface-2 px-4 py-1.5 text-xs font-semibold text-mid">
          Guest mode · <span className="text-neon">Tap to sync Google</span>
        </button>
      )}
    </section>
  );
}
