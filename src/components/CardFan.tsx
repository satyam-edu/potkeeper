import { useState, type CSSProperties } from 'react';
import { after } from '../lib/anim';

type Card = readonly [rank: string, suit: '♠' | '♥' | '♦' | '♣'];

// All six hands of the rules sheet, each listed left, middle, right.
const HANDS: { name: string; cards: readonly [Card, Card, Card] }[] = [
  { name: 'Trail', cards: [['K', '♠'], ['K', '♥'], ['K', '♦']] },
  { name: 'Pure Sequence', cards: [['A', '♠'], ['K', '♠'], ['Q', '♠']] },
  { name: 'Sequence', cards: [['J', '♦'], ['Q', '♠'], ['K', '♥']] },
  { name: 'Color', cards: [['A', '♥'], ['9', '♥'], ['4', '♥']] },
  { name: 'Pair', cards: [['Q', '♠'], ['Q', '♦'], ['7', '♣']] },
  { name: 'High Card', cards: [['A', '♦'], ['9', '♠'], ['4', '♣']] },
];

// Where each slot sits (px at a 144px tall card, scaled with it) and when it is dealt: the middle card last, so it lands on top.
const SLOTS = [
  { x: -58, r: -14, d: 0.3 },
  { x: 0, r: 0, d: 0.6 },
  { x: 58, r: 14, d: 0.45 },
] as const;

/** Cards are dealt, turn over and float. A different hand is dealt only when tapped. Always one row. */
export function CardFan() {
  const [idx, setIdx] = useState(0);
  const another = () => setIdx((n) => (n + 1 + Math.floor(Math.random() * (HANDS.length - 1))) % HANDS.length); // any hand but the one on show
  const hand = HANDS[idx]!;
  // --ch is the card height; everything else is a multiple of it, so the fan shrinks on short screens (and goes away on very short ones).
  return (
    <div style={{ '--ch': 'clamp(84px, 17dvh, 144px)' } as CSSProperties} className="flex flex-col items-center gap-1 [@media(max-height:620px)]:hidden">
      <button
        key={`fan-${idx}`}
        onClick={another}
        aria-label={`${hand.name}. Tap for another hand`}
        style={{ height: 'calc(var(--ch) * 1.22)', width: 'calc(var(--ch) * 1.78)' }}
        className="bob relative active:scale-95"
      >
        {/* middle card last in the DOM so it is on top */}
        {[0, 2, 1].map((i) => {
          const [rank, suit] = hand.cards[i]!;
          const slot = SLOTS[i]!;
          const red = suit === '♥' || suit === '♦';
          return (
            <span
              key={i}
              style={{
                ...after(slot.d),
                '--x': `calc(var(--ch) * ${slot.x / 144})`,
                '--r': `${slot.r}deg`,
                height: 'var(--ch)',
                width: 'calc(var(--ch) * 0.667)',
                marginLeft: 'calc(var(--ch) * -0.333)',
                fontSize: 'calc(var(--ch) / 6)',
              } as CSSProperties}
              className="deal-card absolute left-1/2 top-[6%] block [perspective:600px]"
            >
              <span className="flip-card relative block h-full w-full">
                <span className={`absolute inset-0 flex flex-col justify-between rounded-[0.5em] border-2 border-ink/20 bg-paper p-[0.35em] [backface-visibility:hidden] ${red ? 'text-danger' : 'text-ink'}`}>
                  <span className="display text-[1em] font-bold leading-none">{rank}<span className="block text-[0.75em]">{suit}</span></span>
                  <span className="self-center text-[2.2em] leading-none">{suit}</span>
                  <span className="display rotate-180 text-[1em] font-bold leading-none">{rank}<span className="block text-[0.75em]">{suit}</span></span>
                </span>
                <span className="absolute inset-0 rounded-[0.5em] border-2 border-white bg-[repeating-linear-gradient(45deg,#8e1b1b_0_4px,#b02a2a_4px_8px)] [backface-visibility:hidden] [transform:rotateY(180deg)]" />
              </span>
            </span>
          );
        })}
      </button>
      <p key={`hint-${idx}`} style={after(1.6)} className="fade text-[10px] font-semibold tracking-widest text-mid">{hand.name.toUpperCase()} · TAP FOR ANOTHER HAND</p>
    </div>
  );
}
