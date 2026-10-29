import { useEffect, useRef } from 'react';

/**
 * Catches the browser / phone Back button while `active`. Every Back press is cancelled
 * (we push the entry again) and `onBack` runs instead, so one, two or ten presses never leave by accident.
 */
export function useBackGuard(active: boolean, onBack: () => void) {
  const cb = useRef(onBack);
  cb.current = onBack;
  useEffect(() => {
    if (!active) return;
    history.pushState(null, '', location.href);
    const onPop = () => {
      history.pushState(null, '', location.href);
      cb.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [active]);
}
