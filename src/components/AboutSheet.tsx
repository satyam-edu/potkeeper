const LINES = [
  ['The pot, kept.', "PotKeeper remembers who put in what, so nobody has to 'remember' it differently at midnight."],
  ['No chips needed.', 'Chips get lost under sofas. Your phone mostly does not (we hope).'],
  ['Zero drama.', "The app does the maths. It has no favourites, not even the person who built it."],
  ['Bugs.', "If something looks wrong, it is a feature that has not introduced itself yet. Tell us and we will make it behave."],
];

/** Light hearted "about" sheet with a line about the developer. */
export function AboutSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/80" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="About PotKeeper" onClick={(e) => e.stopPropagation()} className="sheet-up max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-14 w-14 rounded-2xl" />
          <div>
            <h2 className="display text-3xl font-bold leading-none">Pot<span className="text-neon">Keeper</span></h2>
            <p className="text-sm text-mid">3 Patti without chips. Just your phone.</p>
          </div>
        </div>
        <ul className="my-4 flex flex-col gap-3">
          {LINES.map(([title, body]) => (
            <li key={title} className="rounded-2xl bg-surface-2 px-4 py-3">
              <p className="font-bold">{title}</p>
              <p className="text-sm text-mid">{body}</p>
            </li>
          ))}
        </ul>
        <div className="rounded-2xl bg-neon px-4 py-3 text-ink">
          <p className="text-[10px] font-bold tracking-widest opacity-70">MADE BY</p>
          <p className="display text-3xl font-bold leading-tight">SATYAM</p>
          <p className="text-sm font-semibold">Developer, tester, and the person who has now lost to his own app more than once.</p>
        </div>
        <button onClick={onClose} className="mt-4 h-12 w-full rounded-2xl bg-surface-2 font-semibold">Close</button>
      </div>
    </div>
  );
}
