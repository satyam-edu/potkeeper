import { useCallback, useEffect, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { reduce } from '../../shared/engine';
import { toAction } from '../../shared/messages';
import type { ClientMessage, ErrorCode, RoomState, ServerMessage } from '../../shared/types';
import type { Session } from './session';

const HOST = import.meta.env.VITE_PARTYKIT_HOST ?? 'localhost:1999';

// Messages whose result we predict locally with the same engine the server runs.
const OPTIMISTIC = new Set<ClientMessage['t']>(['BET', 'PACK', 'AWARD_POT', 'REORDER', 'SET_BASE_BET']);

export interface RoomError {
  code: ErrorCode;
  id: number;
}

/** Live connection to one room: server state, optimistic overlay, auto-reconnect and re-JOIN. */
export function useRoom(code: string, session: Session, createBaseBet?: number) {
  const [server, setServer] = useState<RoomState | null>(null);
  const [optimistic, setOptimistic] = useState<RoomState | null>(null);
  const [error, setError] = useState<RoomError | null>(null);
  const [online, setOnline] = useState(false);
  const [save, setSave] = useState<'saving' | 'saved' | 'failed'>('saving'); // wallet update after End Game
  const sock = useRef<PartySocket | null>(null);
  const view = useRef<RoomState | null>(null);
  const joined = useRef(false);

  useEffect(() => {
    joined.current = false;
    setSave('saving');
    const ws = new PartySocket({ host: HOST, room: code });
    sock.current = ws;

    ws.addEventListener('open', () => {
      setOnline(true);
      // `create` only on the very first JOIN; reconnects must not try to create again.
      const create = createBaseBet && !joined.current ? { create: { baseBet: createBaseBet } } : {};
      ws.send(JSON.stringify({ t: 'JOIN', token: session.token, name: session.name, ...create }));
    });
    ws.addEventListener('close', () => setOnline(false));
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(String(e.data)) as ServerMessage;
      if (m.t === 'STATE') {
        joined.current = true;
        view.current = m.state;
        setServer(m.state);
        setOptimistic(null);
      } else if (m.t === 'SAVE') {
        setSave(m.status);
      } else if (m.t === 'ERROR') {
        view.current = null;
        setOptimistic(null); // roll back any prediction
        setError({ code: m.code, id: Date.now() });
      }
    });

    // Back from WhatsApp: don't wait for the backoff timer.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && ws.readyState !== WebSocket.OPEN) ws.reconnect();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      ws.close();
    };
  }, [code, session.token, session.name, createBaseBet]);

  const send = useCallback(
    (msg: ClientMessage) => {
      sock.current?.send(JSON.stringify(msg));
      const base = view.current;
      const action = OPTIMISTIC.has(msg.t) ? toAction(msg, '') : null;
      if (!base || !action) return;
      const r = reduce(base, action, session.userId);
      if (r.ok) {
        view.current = r.state;
        setOptimistic(r.state);
      }
    },
    [session.userId],
  );

  return { state: optimistic ?? server, online, error, save, send };
}
