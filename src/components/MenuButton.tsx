import { useEffect, useState } from 'react';

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

/** One round button that drops down Feedback, About and Log out. */
export function MenuButton({ onFeedback, onAbout, onLogout }: { onFeedback: () => void; onAbout: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  const item = 'flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold active:bg-neon active:text-ink';

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-haspopup="menu" aria-expanded={open} className="flex h-11 w-11 items-center justify-center rounded-full btn-quiet text-paper active:scale-95">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div role="menu" className="pop absolute right-0 top-full z-30 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
            <button role="menuitem" onClick={pick(onFeedback)} className={item}>
              <Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
              Feedback
            </button>
            <button role="menuitem" onClick={pick(onAbout)} className={`${item} border-t border-line`}>
              <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01" />
              About
            </button>
            <button role="menuitem" onClick={pick(onLogout)} className={`${item} border-t border-line text-danger`}>
              <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
