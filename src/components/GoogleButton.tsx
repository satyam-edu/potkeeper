import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID, renderGoogleButton } from '../lib/google';
import type { Session } from '../lib/session';

/** Google's own button (required by Google for ID-token sign-in), or a disabled stub if no client ID is configured. */
export function GoogleButton({ onDone }: { onDone: (s: Session) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (box.current) void renderGoogleButton(box.current, onDone, setErr).catch((e: Error) => setErr(e.message));
  }, [onDone]);

  if (!GOOGLE_CLIENT_ID) {
    return <button disabled className="h-14 rounded-2xl bg-paper font-bold text-ink opacity-60">Continue with Google (not configured)</button>;
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={box} className="flex min-h-11 justify-center" />
      {err && <p className="text-sm text-danger">{err}</p>}
    </div>
  );
}
