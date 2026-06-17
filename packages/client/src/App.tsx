import { useUi } from './store.js';
import { Scene } from './render/Scene.js';
import { HUD } from './ui/HUD.js';
import { Lobby } from './ui/Lobby.js';
import { CharacterSelect } from './ui/CharacterSelect.js';

export function App() {
  const status = useUi((s) => s.status);
  const phase = useUi((s) => s.phase);

  if (status !== 'connected') return <Lobby />;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Scene />
      <HUD />
      {phase === 'lobby' && <CharacterSelect />}
    </div>
  );
}
