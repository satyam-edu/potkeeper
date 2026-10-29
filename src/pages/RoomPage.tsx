import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { ConfirmModal } from '../components/ConfirmModal';
import { GameOver } from '../components/GameOver';
import { GameTable } from '../components/GameTable';
import { Lobby } from '../components/Lobby';
import { NamePrompt } from '../components/NamePrompt';
import { Toast } from '../components/Toast';
import { loadSession, saveSession, type Session } from '../lib/session';
import { loadSounds, say } from '../lib/sound';
import { useBackGuard } from '../lib/useBackGuard';
import { useRoom } from '../lib/useRoom';

const newCode = () => String(1000 + Math.floor(Math.random() * 9000));

export function RoomPage({ code }: { code: string }) {
  const [session, setSession] = useState<Session | null>(loadSession);
  // Opened via a shared link without a name yet → ask first, then come straight back in.
  if (!session) {
    return (
      <div className="flex flex-1 flex-col gap-4 pt-10">
        <h1 className="text-2xl font-extrabold">Join room {code}</h1>
        <NamePrompt onDone={setSession} label="Join" />
      </div>
    );
  }
  return <Connected code={code} session={session} onBadToken={() => { saveSession(null); setSession(null); }} />;
}

function Connected({ code, session, onBadToken }: { code: string; session: Session; onBadToken: () => void }) {
  const [, go] = useLocation();
  const create = Number(new URLSearchParams(useSearch()).get('create')) || undefined;
  const { state, online, error, save, send } = useRoom(code, session, create);

  // Clips load as soon as the room opens (not only at the table), so "Game started" is ready when the host taps Start.
  const inRoom = !!state;
  useEffect(() => { if (inRoom) void loadSounds(); }, [inRoom]);
  // Everyone hears it when a round begins: "Game started" from the lobby, "Next round" from between rounds. Never on refresh.
  const phase = state?.phase;
  const lastPhase = useRef(phase);
  useEffect(() => {
    if (phase === 'BETTING' && lastPhase.current === 'LOBBY') say('started');
    else if (phase === 'BETTING' && lastPhase.current === 'BETWEEN_ROUNDS') say('nextround');
    lastPhase.current = phase;
  }, [phase]);

  // Back button: mid-game it asks first; on the Game Over or cashed out screens it just goes home.
  const [leaving, setLeaving] = useState(false);
  const mine = state?.players.find((p) => p.userId === session.userId);
  const inGame = !!state && state.phase !== 'ENDED' && !mine?.cashedOut;
  useBackGuard(!!state, () => (inGame ? setLeaving(true) : go('/')));

  // Once the room exists, drop `?create` so a refresh re-joins this room instead of trying to create it again.
  useEffect(() => {
    if (state && create) go(`/room/${code}`, { replace: true });
  }, [state, create, code, go]);

  useEffect(() => {
    if (error?.code === 'ROOM_EXISTS') go(`/room/${newCode()}?create=${create ?? 5}`, { replace: true }); // 4-digit collision
    if (error?.code === 'BAD_TOKEN') onBadToken();
  }, [error, create, go, onBadToken]);

  if (error?.code === 'ROOM_NOT_FOUND' && !state) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-xl font-bold">Room {code} not found</p>
        <p className="text-mid">Check the code with the host.</p>
        <button onClick={() => go('/')} className="h-12 rounded-xl bg-surface-2 px-6 font-bold">Back</button>
      </div>
    );
  }
  if (!state) return <p className="m-auto text-mid">Connecting…</p>;

  if (state.players.find((p) => p.userId === session.userId)?.cashedOut) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="display text-3xl font-bold">You were cashed out</p>
        <p className="text-mid">The host removed you from this room.</p>
        <button onClick={() => go('/')} className="h-12 rounded-xl bg-surface-2 px-6 font-bold">Back</button>
      </div>
    );
  }

  return (
    <>
      <Toast code={error?.code ?? null} id={error?.id ?? 0} />
      {!online && <p className="fixed inset-x-0 top-0 z-40 bg-ink py-1 text-center text-sm text-neon">Reconnecting…</p>}
      {leaving && inGame && (
        <ConfirmModal
          tone="danger"
          title={state.phase === 'LOBBY' ? 'Leave the room?' : 'Leave the game?'}
          body={
            state.phase === 'LOBBY'
              ? 'Going back takes you out of this room. Join again with the room code.'
              : state.hostId === session.userId
                ? 'Going back takes you out of the game. You are the host, so nobody can undo, end the game or start the next round until you return. Your seat and balance stay.'
                : 'Going back takes you out of the game. Your seat and balance stay, but the table waits for you on your turn. Join again with the room code.'
          }
          confirmLabel={state.phase === 'LOBBY' ? 'Leave room' : 'Leave game'}
          onConfirm={() => { setLeaving(false); go('/'); }}
          onCancel={() => setLeaving(false)}
        />
      )}
      {state.phase === 'ENDED' ? (
        <GameOver state={state} save={save} isHost={state.hostId === session.userId} send={send} onHome={() => go('/')} />
      ) : state.phase === 'LOBBY' ? (
        <Lobby state={state} meId={session.userId} send={send} />
      ) : (
        <GameTable state={state} meId={session.userId} send={send} />
      )}
    </>
  );
}
