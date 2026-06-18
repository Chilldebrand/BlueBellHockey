import { comboMultiplier, getCharacter, getUltimate } from '@bbh/shared';
import { useUi } from '../store.js';

export function UltMeter() {
  const { myUltCharge, myUltActiveUntil, myCombo, serverTime, roster, mySkaterId } = useUi();
  const me = roster.find((r) => r.id === mySkaterId);
  const ult = me ? safeUlt(me.characterId) : null;
  const ready = myUltCharge >= 1;
  const active = myUltActiveUntil > serverTime;
  const pct = Math.round(myUltCharge * 100);
  const ultName = (ult ? ult.name : 'Gamebreaker').toUpperCase();
  const mult = comboMultiplier(myCombo);

  const label = active
    ? `${ultName} — ACTIVE`
    : ready
      ? 'GAMEBREAKER READY (Space)'
      : `STYLE  ${pct}%`;

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
      {myCombo > 0 && (
        <div
          key={myCombo}
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#ff8c19',
            letterSpacing: 1,
            marginBottom: 2,
            textShadow: '0 0 16px rgba(255,140,25,0.85)',
            animation: 'bbhCombo 0.22s ease-out',
          }}
        >
          {mult.toFixed(2)}× · {myCombo} COMBO 🔥
        </div>
      )}
      <div
        style={{
          fontSize: 13,
          marginBottom: 4,
          letterSpacing: ready ? 2 : 0.5,
          fontWeight: ready ? 900 : 700,
          color: ready ? '#ffd23c' : '#dfe6ff',
          textShadow: ready ? '0 0 14px rgba(255,210,60,0.8)' : 'none',
          animation: ready && !active ? 'bbhReady 0.9s ease-in-out infinite' : 'none',
        }}
      >
        {label}
      </div>
      <div
        style={{
          height: 14,
          borderRadius: 8,
          background: '#1a2244',
          border: `1px solid ${ready ? '#ffd23c' : '#2a3566'}`,
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
      {!ready && !active && (
        <div style={{ fontSize: 10, opacity: 0.55, marginTop: 3 }}>
          GAMEBREAKER: {ultName} — play with flair to charge
        </div>
      )}
      <style>{`@keyframes bbhReady{0%,100%{opacity:1}50%{opacity:0.55}}@keyframes bbhCombo{from{transform:scale(1.5)}to{transform:scale(1)}}`}</style>
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
