import type { Player } from '../../shared/types';
import { hue, initials, rupees, signed } from '../lib/format';

export function SeatCard({ p, isTurn, isMe, isHost, won, onClick }: { p: Player; isTurn: boolean; isMe: boolean; isHost: boolean; won?: boolean; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  const out = p.cashedOut || p.status === 'PACKED';
  const waiting = p.status === 'WAITING' && !p.cashedOut;
  return (
    <Tag
      onClick={onClick}
      className={[
        'flex w-[84px] flex-col items-center gap-0.5 rounded-[20px] border px-1.5 py-2 text-center transition-all',
        isTurn ? 'border-neon bg-surface shadow-[0_0_18px_rgba(198,255,0,.45)] animate-pulse' : 'border-line bg-surface',
        won ? 'border-neon bg-neon/15' : '',
        waiting ? 'border-dashed' : '',
        out ? 'opacity-40 grayscale' : '',
      ].join(' ')}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-ink"
        style={{ background: `hsl(${hue(p.userId)} 80% 70%)` }}
      >
        {initials(p.name)}
      </div>
      <p className="w-full truncate text-xs font-semibold">{p.name}</p>
      <p className={`display text-base font-bold leading-none tabular-nums ${p.sessionBalance < 0 ? 'text-danger' : p.sessionBalance > 0 ? 'text-neon' : 'text-white'}`}>
        {signed(p.sessionBalance)}
      </p>
      <p className="text-[10px] text-mid">
        {p.cashedOut ? 'Cashed out' : waiting ? 'Next round' : p.status === 'PACKED' ? 'Packed' : `In ${rupees(p.roundBet)}`}
      </p>
      {(isMe || isHost) && (
        <p className="flex gap-1 text-[9px] font-bold uppercase">
          {isMe && <span className="rounded bg-paper px-1 text-ink">You</span>}
          {isHost && <span className="rounded bg-surface-2 px-1 text-neon">Host</span>}
        </p>
      )}
    </Tag>
  );
}
