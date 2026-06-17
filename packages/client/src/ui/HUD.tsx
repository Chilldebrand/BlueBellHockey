import { useUi } from '../store.js';
import { Scoreboard } from './Scoreboard.js';
import { UltMeter } from './UltMeter.js';

export function HUD() {
  const phase = useUi((s) => s.phase);
  const phaseTimer = useUi((s) => s.phaseTimer);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Scoreboard />
      <UltMeter />
      {phase === 'countdown' && (
        <Banner text={`${Math.ceil(phaseTimer / 1000)}`} big />
      )}
      {phase === 'intermission' && <Banner text="INTERMISSION" />}
      {phase === 'ended' && <Banner text="FINAL" />}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          fontSize: 11,
          opacity: 0.6,
          lineHeight: 1.5,
        }}
      >
        WASD / arrows move · mouse aim · J / LMB shoot · K / RMB pass<br />
        Shift hit · F steal · Space / E ultimate · (gamepad supported)
      </div>
    </div>
  );
}

function Banner({ text, big }: { text: string; big?: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: big ? 96 : 48,
        fontWeight: 900,
        textShadow: '0 4px 20px rgba(0,0,0,0.6)',
      }}
    >
      {text}
    </div>
  );
}
