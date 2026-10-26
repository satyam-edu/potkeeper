import { useEffect, useRef } from 'react';

const TONE = {
  danger: 'bg-danger text-white',
  neon: 'bg-neon text-ink',
  paper: 'bg-paper text-ink',
} as const;

/** "Are you sure?" gate for destructive / game-altering taps. Confirm is never auto-focused. */
export function ConfirmModal({
  title,
  body,
  confirmLabel,
  tone = 'neon',
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  tone?: keyof typeof TONE;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-6" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[360px] flex-col gap-4 rounded-[28px] border border-line bg-surface p-5"
      >
        <h2 id="confirm-title" className="display text-3xl font-bold leading-tight">{title}</h2>
        <p id="confirm-body" className="text-mid">{body}</p>
        <div className="flex flex-col gap-2">
          <button onClick={onConfirm} className={`display h-14 rounded-2xl text-xl font-bold active:scale-[.98] ${TONE[tone]}`}>
            {confirmLabel}
          </button>
          <button ref={cancelRef} onClick={onCancel} className="h-12 rounded-2xl bg-surface-2 font-semibold active:scale-[.98]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
