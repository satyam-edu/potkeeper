import { useState } from 'react';
import type { Player } from '../../shared/types';
import { hue, signed } from '../lib/format';

const tone = (n: number) => (n < 0 ? 'text-danger' : n > 0 ? 'text-neon' : 'text-white');

/**
 * A seat: a round avatar with a small plate over its bottom edge holding the first name and this round's net (the game total
 * lives in the Scoreboard). Host and dealer are small badges on the avatar. About 60px tall, so ten fit around the table.
 */
export function SeatCard({ p, label, net, dealer, isTurn, isMe, isHost, won, onClick }: { p: Player; label: string; net: number; dealer?: boolean; isTurn: boolean; isMe: boolean; isHost: boolean; won?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  const [broken, setBroken] = useState(false); // a photo that fails to load falls back to the letter
  const photo = !!p.avatarUrl && !broken;
  const waiting = p.status === 'WAITING';
  const out = p.status === 'PACKED';
  const ring = won ? 'border-neon shadow-[0_0_14px_rgba(198,255,0,.7)]' : isTurn ? 'border-white shadow-[0_0_16px_rgba(255,255,255,.7)]' : isMe ? 'border-neon/80' : 'border-white/30';
  const plate = won ? 'border-neon' : isTurn ? 'border-white/70' : 'border-line';
  return (
    <Tag onClick={onClick} className={`relative flex w-[72px] flex-col items-center ${out ? 'opacity-40' : ''}`}>
      <span
        className={`display grid h-10 w-10 place-items-center overflow-hidden rounded-full border-2 text-xl font-bold text-ink ${ring} ${waiting ? 'border-dashed' : ''}`}
        style={{ background: `hsl(${hue(p.userId)} 80% 70%)` }}
      >
        {photo ? <img src={p.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" /> : [...p.name][0]?.toUpperCase() ?? '?'}
      </span>
      {isHost && <span aria-label="Host" className="absolute right-0 top-0 z-20 rounded bg-neon px-1 text-[7px] font-extrabold leading-3 text-ink">HOST</span>}
      {dealer && <span aria-label="Dealer" className="absolute left-1 top-0 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-paper text-[9px] font-bold text-ink shadow">D</span>}
      <span className={`relative z-10 -mt-3 flex w-max min-w-[52px] max-w-[104px] flex-col items-center rounded-lg border bg-ink/95 px-1.5 py-0.5 text-center ${plate}`}>
        <span className={`block text-[10px] font-semibold leading-[11px] break-words ${isMe ? 'text-neon' : ''}`}>{label}</span>
        {waiting
          ? <span className="text-[9px] font-semibold uppercase leading-[14px] text-mid">Next round</span>
          : <span className={`text-[13px] font-bold leading-[14px] tabular-nums ${tone(net)}`}>{signed(net)}</span>}
      </span>
    </Tag>
  );
}
