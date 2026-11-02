import { after } from '../lib/anim';

const Letters = ({ text, from, className = '' }: { text: string; from: number; className?: string }) => (
  <span className={className} aria-hidden="true">
    {[...text].map((ch, i) => (
      <span key={i} style={after(0.15 + (from + i) * 0.06)} className="letter-pop">{ch}</span>
    ))}
  </span>
);

export function Hero() {
  return (
    <header className="pt-[clamp(0.25rem,3dvh,2rem)] text-center">
      <img src="/logo.png" alt="" style={after(0)} className="rise mx-auto mb-[clamp(0.25rem,1.5dvh,1rem)] h-[clamp(56px,10dvh,96px)] w-[clamp(56px,10dvh,96px)] rounded-[22px]" />
      <h1 aria-label="PotKeeper" className="display text-[clamp(2.75rem,8.5dvh,3.75rem)] font-bold leading-none text-white">
        <Letters text="Pot" from={0} />
        <Letters text="Keeper" from={3} className="text-neon" />
      </h1>
      <p style={after(0.85)} className="fade mt-1 text-mid">3 Patti without chips. Just your phone.</p>
    </header>
  );
}
