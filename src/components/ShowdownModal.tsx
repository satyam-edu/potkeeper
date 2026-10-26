import { useState } from 'react';
import { splitPot } from '../../shared/engine';
import type { Player } from '../../shared/types';
import { rupees } from '../lib/format';
import { ConfirmModal } from './ConfirmModal';

/** "Who won?" — only ACTIVE players are listed; 2+ selected = tie split. Awarding needs a second confirm. */
export function ShowdownModal({ pot, active, onAward, onClose }: { pot: number; active: Player[]; onAward: (ids: string[]) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const toggle = (id: string) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const winners = active.filter((p) => picked.includes(p.userId));
  const { share, remainder } = splitPot(pot, Math.max(winners.length, 1));
  const preview =
    winners.length === 0
      ? 'Select the winner — or several for a tie'
      : winners.length === 1
        ? `${winners[0]!.name} takes ${rupees(pot)}`
        : `${rupees(share)} each${remainder ? `, ${rupees(remainder)} carries to the next round` : ''}`;
  const names = winners.map((w) => w.name).join(' & ');

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/80" onClick={onClose}>
        <div role="dialog" aria-modal="true" aria-label="Who won?" onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-t-[28px] bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <div className="flex items-baseline justify-between">
            <h2 className="display text-3xl font-bold">Who won?</h2>
            <span className="display text-2xl font-bold text-neon tabular-nums">{rupees(pot)}</span>
          </div>
          <ul className="my-4 flex flex-col gap-2">
            {active.map((p) => {
              const on = picked.includes(p.userId);
              return (
                <li key={p.userId}>
                  <button
                    onClick={() => toggle(p.userId)}
                    aria-pressed={on}
                    className={`flex h-14 w-full items-center gap-3 rounded-2xl px-4 text-left font-semibold ${on ? 'bg-paper text-ink' : 'bg-surface-2'}`}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm ${on ? 'border-ink bg-neon' : 'border-mid'}`}>{on && '✓'}</span>
                    {p.name}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mb-3 min-h-5 text-center text-sm text-mid" aria-live="polite">{preview}</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="h-14 basis-1/3 rounded-2xl bg-surface-2 font-semibold">Cancel</button>
            <button
              disabled={winners.length === 0}
              onClick={() => setConfirming(true)}
              className="display h-14 flex-1 rounded-2xl bg-neon text-xl font-bold text-ink shadow-[0_4px_0_#8fb300] active:translate-y-[2px] active:shadow-none disabled:bg-surface-2 disabled:text-mid disabled:shadow-none"
            >
              Award Pot
            </button>
          </div>
        </div>
      </div>
      {confirming && (
        <ConfirmModal
          title={winners.length === 1 ? `Award ${rupees(pot)} to ${names}?` : `Split ${rupees(pot)} between ${names}?`}
          body={winners.length === 1 ? 'The host can undo this afterwards.' : `${rupees(share)} each${remainder ? `, ${rupees(remainder)} carries over` : ''}. The host can undo this afterwards.`}
          confirmLabel="Award"
          onConfirm={() => onAward(winners.map((w) => w.userId))}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
