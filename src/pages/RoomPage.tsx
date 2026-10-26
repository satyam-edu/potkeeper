import { useEffect, useState } from 'react';
import { useLocation, useSearch } from 'wouter';
import { GameTable } from '../components/GameTable';
import { Lobby } from '../components/Lobby';
import { NamePrompt } from '../components/NamePrompt';
import { Toast } from '../components/Toast';
import { loadSession, saveSession, type Session } from '../lib/session';
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
  const { state, online, error, send } = useRoom(code, session, create);

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
      {!online && <p className="mb-2 rounded-lg bg-neon/15 py-1 text-center text-sm text-neon">Reconnecting…</p>}
      {state.phase === 'LOBBY' ? (
        <Lobby state={state} meId={session.userId} send={send} />
      ) : (
        <GameTable state={state} meId={session.userId} send={send} />
      )}
    </>
  );
}
