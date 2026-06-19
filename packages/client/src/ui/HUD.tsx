import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useUi } from '../store.js';
import { net } from '../net/client.js';
import { controls, tokenLabel, type BindableAction } from '../input/bindings.js';
import { Scoreboard } from './Scoreboard.js';
import { UltMeter } from './UltMeter.js';
import { Callouts } from './Callouts.js';
import { Postgame } from './Postgame.js';

export function HUD() {
  const phase = useUi((s) => s.phase);
  const phaseTimer = useUi((s) => s.phaseTimer);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <FlashOverlay />
      <Scoreboard />
      <UltMeter />
      <Callouts />
      <GoalBanner />
      {phase === 'countdown' && (
        <Banner text={`${Math.ceil(phaseTimer / 1000)}`} big />
      )}
      {phase === 'intermission' && <Banner text="INTERMISSION" />}
      {phase === 'ended' && <Postgame />}
      <ControlsHint />
      <AudioControl />
    </div>
  );
}

// Bottom-left key hint, generated from the live bindings so it stays accurate
// after a player remaps anything. Shows each action's primary (first) binding.
function ControlsHint() {
  const bindings = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const primary = (a: BindableAction): string => {
    const t = bindings.keyboard[a][0];
    return t ? tokenLabel(t) : '—';
  };
  const move = ['moveUp', 'moveLeft', 'moveDown', 'moveRight']
    .map((a) => primary(a as BindableAction))
    .join('');

  return (
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
      {move} move · mouse aim · {primary('shoot')} shoot (hold = slap) · {primary('pass')} pass ·{' '}
      {primary('hit')} hit<br />
      {primary('steal')} stick lift · {primary('poke')} poke · {primary('deke')} deke ·{' '}
      {primary('ult')} ult · M mute · ⚙ remap
    </div>
  );
}

// Brief full-screen flash for the biggest moments. Re-keyed per event so the CSS
// animation retriggers; auto-removed by a timer so nothing lingers.
function FlashOverlay() {
  const [flash, setFlash] = useState<{ color: string; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const fire = (color: string, ms: number) => {
      seq.current += 1;
      setFlash({ color, key: seq.current });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(null), ms);
    };
    const offGb = net.events.on('gamebreaker', () => fire('rgba(255,210,60,0.55)', 600));
    const offAnkle = net.events.on('ankle_break', () => fire('rgba(255,210,60,0.18)', 320));
    return () => {
      offGb();
      offAnkle();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!flash) return null;
  return (
    <div
      key={flash.key}
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 45%, ${flash.color}, transparent 70%)`,
        animation: 'bbhFlash 0.5s ease-out forwards',
      }}
    >
      <style>{`@keyframes bbhFlash{from{opacity:1}to{opacity:0}}`}</style>
    </div>
  );
}

// Player-facing mute + volume control (the game previously had no way to mute).
function AudioControl() {
  const muted = useUi((s) => s.muted);
  const volume = useUi((s) => s.volume);
  const set = useUi((s) => s.set);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') set({ muted: !useUi.getState().muted });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [set]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        right: 14,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={() => set({ controlsOpen: true })}
        title="Controls"
        style={{
          background: 'rgba(20,28,52,0.7)',
          border: '1px solid #2a3566',
          color: '#dfe6ff',
          borderRadius: 6,
          width: 30,
          height: 26,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        ⚙
      </button>
      <button
        onClick={() => set({ muted: !muted })}
        title="Mute (M)"
        style={{
          background: 'rgba(20,28,52,0.7)',
          border: '1px solid #2a3566',
          color: '#dfe6ff',
          borderRadius: 6,
          width: 30,
          height: 26,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={(e) => set({ volume: parseFloat(e.target.value), muted: false })}
        style={{ width: 90, accentColor: '#4f7cff' }}
      />
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
