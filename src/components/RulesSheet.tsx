const HANDS: { name: string; note: string; cards: string[] }[] = [
  { name: 'Trail / Set', note: 'Three of a kind · AAA highest, 222 lowest', cards: ['A♠', 'A♥', 'A♦'] },
  { name: 'Pure Sequence', note: 'Straight flush · AKQ highest, A23 next, … 432 lowest', cards: ['K♥', 'Q♥', 'J♥'] },
  { name: 'Sequence', note: 'Run, mixed suits · AKQ highest, … 432 lowest', cards: ['A♠', 'K♥', 'Q♦'] },
  { name: 'Color', note: 'Flush · AKJ highest, 532 lowest', cards: ['A♠', 'J♠', '7♠'] },
  { name: 'Pair', note: 'Two of a kind · AAK highest, 223 lowest', cards: ['Q♠', 'Q♦', '9♣'] },
  { name: 'High Card', note: 'Nothing else · AKJ highest, 532 lowest', cards: ['A♠', 'J♥', '5♦'] },
];

const Card = ({ c }: { c: string }) => (
  <span className={`display flex h-9 w-7 items-center justify-center rounded-md bg-paper text-sm font-bold ${/[♥♦]/.test(c) ? 'text-danger' : 'text-ink'}`}>{c}</span>
);

export function RulesSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/80" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Hand rankings" onClick={(e) => e.stopPropagation()} className="max-h-[85dvh] w-full max-w-[420px] overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <h2 className="display mb-1 text-3xl font-bold">Hand <span className="text-neon">rankings</span></h2>
        <p className="mb-4 text-sm text-mid">Highest to lowest</p>
        <ol className="flex flex-col gap-2">
          {HANDS.map((h, i) => (
            <li key={h.name} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
              <span className="display w-5 text-center text-xl font-bold text-neon">{i + 1}</span>
              <div className="flex-1">
                <p className="font-bold">{h.name}</p>
                <p className="text-xs text-mid">{h.note}</p>
              </div>
              <div className="flex gap-1">{h.cards.map((c) => <Card key={c} c={c} />)}</div>
            </li>
          ))}
        </ol>
        <button onClick={onClose} className="mt-4 h-12 w-full rounded-2xl bg-neon font-bold text-ink">Got it</button>
      </div>
    </div>
  );
}
