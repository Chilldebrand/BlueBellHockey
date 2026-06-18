import { useEffect, useRef, useState } from 'react';
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
        Shift hit · F steal · Q deke · Space / E ultimate · (gamepad supported)
      </div>
    </div>
  );
}

interface GoalDisplay {
  team: number;
  gb: boolean;
  value: number;
}

function GoalBanner() {
  const [goal, setGoal] = useState<GoalDisplay | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const arm = (ms: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setGoal(null), ms);
    };
    // A Gamebreaker emits its own richer event right after the plain goal; don't
    // let the goal handler downgrade it back to a normal banner.
    const offGoal = net.events.on('goal', (e: { team: number }) => {
      setGoal((cur) => (cur?.gb ? cur : { team: e.team, gb: false, value: 1 }));
      arm(2200);
    });
    const offGb = net.events.on('gamebreaker', (e: { team: number; value: number }) => {
      setGoal({ team: e.team, gb: true, value: e.value });
      arm(3200);
    });
    return () => {
      offGoal();
      offGb();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (goal === null) return null;
  const color = goal.gb ? '#ffd23c' : goal.team === 0 ? '#3c6bff' : '#ff5a3c';
  const side = goal.team === 0 ? 'HOME' : 'AWAY';
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
      <div
        style={{
          fontSize: goal.gb ? 96 : 120,
          fontWeight: 900,
          color,
          textShadow: goal.gb
            ? '0 0 40px rgba(255,210,60,0.9), 0 6px 30px rgba(0,0,0,0.7)'
            : '0 6px 30px rgba(0,0,0,0.7)',
          letterSpacing: goal.gb ? 2 : 4,
        }}
      >
        {goal.gb ? 'GAMEBREAKER!!!' : 'GOAL!'}
      </div>
      <div style={{ fontSize: goal.gb ? 30 : 22, fontWeight: 800, opacity: 0.9 }}>
        {goal.gb ? `${side} +${goal.value}` : `${side} scores`}
      </div>
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
