import { getCharacter, getUltimate } from '@bbh/shared';
import { useUi } from '../store.js';

export function UltMeter() {
  const { myUltCharge, myUltActiveUntil, serverTime, roster, mySkaterId } = useUi();
  const me = roster.find((r) => r.id === mySkaterId);
  const ult = me ? safeUlt(me.characterId) : null;
  const ready = myUltCharge >= 1;
  const active = myUltActiveUntil > serverTime;
  const pct = Math.round(myUltCharge * 100);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 320,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, marginBottom: 4, opacity: 0.85 }}>
        {ult ? ult.name : 'Ultimate'} {active ? '— ACTIVE' : ready ? '— READY (Space)' : `${pct}%`}
      </div>
      <div
        style={{
          height: 14,
          borderRadius: 8,
          background: '#1a2244',
          border: '1px solid #2a3566',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: ready ? '#ffd23c' : '#4f7cff',
            boxShadow: ready ? '0 0 12px #ffd23c' : 'none',
            transition: 'width 120ms linear',
          }}
        />
      </div>
    </div>
  );
}

function safeUlt(characterId: string) {
  try {
    return getUltimate(getCharacter(characterId).ultimateId);
  } catch {
    return null;
  }
}
