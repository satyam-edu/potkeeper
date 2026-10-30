import { useEffect, useState } from 'react';
import type { ErrorCode } from '../../shared/types';

const TEXT: Partial<Record<ErrorCode, string>> = {
  NOT_YOUR_TURN: "It's not your turn",
  NOT_HOST: 'Only the host can do that',
  ROOM_FULL: 'Room is full (max 10)',
  NOT_ENOUGH_PLAYERS: 'Need at least 2 players',
  WRONG_PHASE: "That can't be done right now",
  NOTHING_TO_UNDO: 'Nothing to undo',
  REMOVED: 'You were cashed out',
  NOT_SAVED: 'Wait until the game is saved',
};

export function Toast({ code, id }: { code: ErrorCode | null; id: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!code) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 2500);
    return () => clearTimeout(t);
  }, [code, id]);
  if (!code || !shown) return null;
  return (
    <div role="alert" className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-danger px-4 py-2 text-sm font-bold shadow-lg">
      {TEXT[code] ?? `Error: ${code}`}
    </div>
  );
}
