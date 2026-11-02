import { after } from '../lib/anim';

export function Hero() {
  return (
    <header className="pt-8 text-center">
      <img src="/logo.png" alt="" style={after(0)} className="rise mx-auto mb-4 h-24 w-24 rounded-[22px]" />
      <h1 style={after(0.12)} className="rise display text-6xl font-bold leading-none text-white">
        Pot<span className="text-neon">Keeper</span>
      </h1>
      <p style={after(0.24)} className="rise mt-2 text-mid">3 Patti without chips. Just your phone.</p>
    </header>
  );
}
