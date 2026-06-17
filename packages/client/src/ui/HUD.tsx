import { useEffect, useState } from 'react';
import { useUi } from '../store.js';
import { net } from '../net/client.js';
import { Scoreboard } from './Scoreboard.js';
import { UltMeter } from './UltMeter.js';

export function HUD() {
  const phase = useUi((s) => s.phase);
  const phaseTimer = useUi((s) => s.phaseTimer);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Scoreboard />
      <UltMeter />
      <GoalBanner />
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

function GoalBanner() {
  const [team, setTeam] = useState<number | null>(null);
  useEffect(() => {
    return net.events.on('goal', (e: { team: number }) => {
      setTeam(e.team);
      const id = setTimeout(() => setTeam(null), 2200);
      return () => clearTimeout(id);
    });
  }, []);
  if (team === null) return null;
  const color = team === 0 ? '#3c6bff' : '#ff5a3c';
  return (
    <div
      style={{
        position: 'absolute',
        top: '34%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        animation: 'bbhGoal 0.4s ease-out',
      }}
    >
      <div style={{ fontSize: 120, fontWeight: 900, color, textShadow: '0 6px 30px rgba(0,0,0,0.7)', letterSpacing: 4 }}>
        GOAL!
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, opacity: 0.85 }}>{team === 0 ? 'HOME' : 'AWAY'} scores</div>
      <style>{`@keyframes bbhGoal{from{transform:translate(-50%,-50%) scale(0.5);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}`}</style>
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
