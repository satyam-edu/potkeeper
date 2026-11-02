const FACES = [['♠', 'text-ink'], ['♥', 'text-danger'], ['♦', 'text-danger']] as const;

// Card size, the space it takes (so nothing jumps when the content arrives) and the suit size.
const SIZE = {
  sm: { box: 'h-8', wh: 'h-6 w-[18px]', face: 'rounded-[3px] border', suit: 'text-xs' },
  md: { box: 'h-[3.75rem]', wh: 'h-14 w-10', face: 'rounded-md border-2', suit: 'text-3xl' },
  lg: { box: 'h-24', wh: 'h-20 w-14', face: 'rounded-lg border-2', suit: 'text-5xl' },
} as const;

/** The loading sign everywhere: three cards fanned out, turning over one after another (card-flip in index.css). */
export function DealingCards({ size = 'md', label = 'Loading' }: { size?: keyof typeof SIZE; label?: string }) {
  const s = SIZE[size];
  return (
    <span role="status" aria-label={label} className={`flex items-center justify-center ${s.box}`}>
      {FACES.map(([suit, color], i) => (
        <span key={suit} style={{ transform: `rotate(${(i - 1) * 14}deg)` }} className="-mx-1 [perspective:400px]">
          <span className={`card-flip relative block ${s.wh}`} style={{ animationDelay: `${i * 0.18}s` }}>
            <span className={`absolute inset-0 border-white bg-[repeating-linear-gradient(45deg,#8e1b1b_0_3px,#b02a2a_3px_6px)] [backface-visibility:hidden] ${s.face}`} />
            <span className={`absolute inset-0 flex items-center justify-center border-ink/20 bg-paper [backface-visibility:hidden] [transform:rotateY(180deg)] ${s.suit} ${color} ${s.face}`}>{suit}</span>
          </span>
        </span>
      ))}
    </span>
  );
}
