import { useUi } from './store.js';
import { Scene } from './render/Scene.js';
import { HUD } from './ui/HUD.js';
import { Lobby } from './ui/Lobby.js';
import { CharacterSelect } from './ui/CharacterSelect.js';
import { ControlsPanel } from './ui/ControlsPanel.js';

export function App() {
  const status = useUi((s) => s.status);
  const phase = useUi((s) => s.phase);

  return (
    <>
      {status !== 'connected' ? (
        <Lobby />
      ) : (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Scene />
          <HUD />
          {phase === 'lobby' && <CharacterSelect />}
        </div>
      )}
      {/* Rebind menu — overlays both the lobby and the live match. */}
      <ControlsPanel />
    </>
  );
}
