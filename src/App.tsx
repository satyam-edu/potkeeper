import { Route, Switch } from 'wouter';
import { Home } from './pages/Home';
import { RoomPage } from './pages/RoomPage';

export default function App() {
  return (
    <div className="felt min-h-dvh">
      <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/room/:code">{(p) => <RoomPage code={p.code} />}</Route>
          <Route>Not found</Route>
        </Switch>
      </main>
    </div>
  );
}
