import type { Player } from '../../shared/types';
import { signed } from '../lib/format';

const BACK = 'bg-[repeating-linear-gradient(45deg,#8e1b1b_0_3px,#b02a2a_3px_6px)]';

/** `net` is this round only; the game total lives in the Scoreboard. Three face down cards peek out above a seat that is in the round. */
export function SeatCard({ p, net, fluid, dealer, isTurn, isMe, isHost, won, onClick }: { p: Player; net: number; fluid?: boolean; dealer?: boolean; isTurn: boolean; isMe: boolean; isHost: boolean; won?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  const out = p.cashedOut || p.status === 'PACKED';
  const waiting = p.status === 'WAITING' && !p.cashedOut;
  const dealt = !fluid && !p.cashedOut && !waiting; // cards are left out of the compact grid
  // One small line under the amount: status first, otherwise who this seat is.
  const note = p.cashedOut ? 'Cashed out' : waiting ? 'Next round' : p.status === 'PACKED' ? 'Packed' : [isMe && 'You', isHost && 'Host'].filter(Boolean).join(' · ');
  return (
    <div className={`relative ${fluid ? 'w-full' : 'w-[76px]'}`}>
      {dealt && (
        <span aria-hidden="true" className={`absolute -top-3.5 left-1/2 flex -translate-x-1/2 ${out ? 'opacity-30' : ''}`}>
          {[-14, 0, 14].map((r) => (
            <span key={r} style={{ transform: `rotate(${r}deg)` }} className={`-mx-0.5 h-6 w-[18px] rounded-[3px] border border-white ${BACK}`} />
          ))}
        </span>
      )}
      <Tag
        onClick={onClick}
        className={[
          'relative z-10 flex w-full flex-col items-center gap-0.5 rounded-[18px] border-2 py-1.5 text-center',
          fluid ? 'px-0.5' : 'px-1',
          isTurn ? 'border-white bg-surface shadow-[0_0_22px_rgba(255,255,255,.45)]' : 'border-line bg-surface',
          won ? 'border-neon bg-neon/15' : '',
          waiting ? 'border-dashed' : '',
          out ? 'opacity-40' : '',
        ].join(' ')}
      >
        <p className={`w-full font-semibold leading-tight [overflow-wrap:anywhere] ${fluid ? 'text-[10px]' : 'text-[11px]'}`}>{p.name}</p>
        <p className={`${fluid ? 'text-base' : 'text-lg'} font-bold leading-none tabular-nums ${net < 0 ? 'text-danger' : net > 0 ? 'text-neon' : 'text-white'}`}>
          {signed(net)}
        </p>
        <p className={`min-h-3 font-semibold uppercase leading-none text-mid text-[8px]`}>{note}</p>
      </Tag>
      {dealer && (
        <span aria-label="Dealer" className={`absolute z-20 flex items-center justify-center rounded-full bg-paper font-bold text-ink ${fluid ? '-right-0.5 -top-1 h-4 w-4 text-[9px]' : '-right-2 -top-1 h-5 w-5 text-[10px]'}`}>D</span>
      )}
    </div>
  );
}
