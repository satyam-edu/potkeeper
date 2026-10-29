import { useState } from 'react';
import { setSoundOn, soundOn } from '../lib/sound';

/** Voice on / off, remembered on this phone. */
export function SoundToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useState(soundOn);
  return (
    <button
      onClick={() => { setSoundOn(!on); setOn(!on); }}
      aria-label={on ? 'Turn voice off' : 'Turn voice on'}
      aria-pressed={on}
      className={`flex h-7 w-7 items-center justify-center rounded-full ${on ? 'text-neon' : 'text-mid'} ${className}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        {on ? <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
      </svg>
    </button>
  );
}
