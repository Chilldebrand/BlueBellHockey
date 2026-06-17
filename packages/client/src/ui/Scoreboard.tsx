import { useUi } from '../store.js';

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function periodLabel(period: number, phase: string): string {
  if (phase === 'overtime') return 'OT';
  if (phase === 'intermission') return 'INT';
  if (phase === 'ended') return 'FINAL';
  if (phase === 'countdown' || phase === 'lobby') return 'WARMUP';
  return `P${period}`;
}

export function Scoreboard() {
  const { score0, score1, clock: c, period, phase } = useUi();
  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        background: 'rgba(8,12,28,0.82)',
        border: '1px solid #2a3566',
        borderRadius: 12,
        padding: '10px 18px',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <Team name="HOME" color="#3c6bff" score={score0} />
      <div style={{ textAlign: 'center', minWidth: 80 }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>{clock(c)}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{periodLabel(period, phase)}</div>
      </div>
      <Team name="AWAY" color="#ff5a3c" score={score1} />
    </div>
  );
}

function Team({ name, color, score }: { name: string; color: string; score: number }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 64 }}>
      <div style={{ fontSize: 12, color, fontWeight: 700 }}>{name}</div>
      <div style={{ fontSize: 30, fontWeight: 800 }}>{score}</div>
    </div>
  );
}
