// Spoken "2", "Pack", "Show" on the action buttons. Clips are decoded once into memory and played through
// Web Audio, so a tap starts the sound immediately (no network, no decoding, no speech engine warm up).
const KEY = 'pk_sound';
const MAX_CLIP = 70; // amounts above this stay silent

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
let loading: Promise<void> | null = null;
let current: AudioBufferSourceNode | null = null;

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode: not remembered */ }
}

function context(): AudioContext | null {
  if (!ctx && typeof AudioContext !== 'undefined') ctx = new AudioContext();
  return ctx;
}

/** Phones only allow audio after a tap. Call once at startup so any tap (Create, Join, a name field) unlocks it before the first clip is needed. */
export function armAudio() {
  const c = context();
  if (c) window.addEventListener('pointerdown', () => void c.resume(), { once: true });
}

/** Fetch and decode every clip. Call when the table opens; phones only allow audio after a tap, so also unlock on the first one. */
export function loadSounds(): Promise<void> {
  const c = context();
  if (!c) return Promise.resolve();
  const unlock = () => void c.resume();
  window.addEventListener('pointerdown', unlock, { once: true });
  loading ??= Promise.all(
    ['pack', 'show', 'started', 'nextround', ...Array.from({ length: MAX_CLIP }, (_, i) => `n${i + 1}`)].map(async (name) => {
      try {
        const res = await fetch(`/sounds/${name}.mp3`);
        if (res.ok) buffers.set(name, await c.decodeAudioData(await res.arrayBuffer()));
      } catch {
        /* a missing clip falls back to the phone's own voice */
      }
    }),
  ).then(() => undefined);
  return loading;
}

/** Say a bet amount (₹1 to ₹70 from a clip, nothing above that), or "pack" / "show" / "game started" / "next round". */
export function say(what: number | 'pack' | 'show' | 'started' | 'nextround') {
  if (!soundOn() || (typeof what === 'number' && what > MAX_CLIP)) return;
  const name = typeof what === 'number' ? `n${what}` : what;
  const c = context();
  const buf = buffers.get(name);
  if (!c || !buf) {
    // Clips not loaded yet (or missing): use the phone's own voice for this one.
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.speak(new SpeechSynthesisUtterance(what === 'started' ? 'Game started' : what === 'nextround' ? 'Next round' : String(what)));
    return;
  }
  void c.resume();
  current?.stop(); // a quick second tap cuts the first word instead of stacking on it
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
  current = src;
}
