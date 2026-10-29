import type { Player } from '../../shared/types';
import { signed } from '../lib/format';

/** `net` is this round only; the game total lives in the Scoreboard. */
export function SeatCard({ p, net, fluid, isTurn, isMe, isHost, won, onClick }: { p: Player; net: number; fluid?: boolean; isTurn: boolean; isMe: boolean; isHost: boolean; won?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  const out = p.cashedOut || p.status === 'PACKED';
  const waiting = p.status === 'WAITING' && !p.cashedOut;
  // One small line under the amount: status first, otherwise who this seat is.
  const note = p.cashedOut ? 'Cashed out' : waiting ? 'Next round' : p.status === 'PACKED' ? 'Packed' : [isMe && 'You', isHost && 'Host'].filter(Boolean).join(' · ');
  return (
    <Tag
      onClick={onClick}
      className={[
        `flex ${fluid ? 'w-full px-0.5' : 'w-[84px] px-1.5'} flex-col items-center gap-0.5 rounded-[20px] border-2 py-2 text-center`,
        isTurn ? 'border-white bg-surface shadow-[0_0_22px_rgba(255,255,255,.45)]' : 'border-line bg-surface',
        won ? 'border-neon bg-neon/15' : '',
        waiting ? 'border-dashed' : '',
        out ? 'opacity-40' : '',
      ].join(' ')}
    >
      <p className={`w-full font-semibold leading-tight [overflow-wrap:anywhere] ${fluid ? 'text-[10px]' : 'text-sm'}`}>{p.name}</p>
      <p className={`${fluid ? 'text-base' : 'text-xl'} font-bold leading-none tabular-nums ${net < 0 ? 'text-danger' : net > 0 ? 'text-neon' : 'text-white'}`}>
        {signed(net)}
      </p>
      <p className={`min-h-3 font-semibold uppercase leading-none text-mid ${fluid ? 'text-[8px]' : 'text-[10px]'}`}>{note}</p>
    </Tag>
  );
}
