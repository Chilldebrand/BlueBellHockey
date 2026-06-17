import { CHARACTERS, getUltimate, type AttributeKey } from '@bbh/shared';
import { net } from '../net/client.js';
import { useUi } from '../store.js';

const ATTRS: AttributeKey[] = ['speed', 'hit', 'steal', 'shoot', 'pass'];

export function CharacterSelect() {
  const selected = useUi((s) => s.selectedCharacter);
  const set = useUi((s) => s.set);

  const choose = (id: string) => {
    set({ selectedCharacter: id });
    net.selectCharacter(id);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(6,9,22,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 24,
        overflow: 'auto',
      }}
    >
      <h1 style={{ margin: '4px 0 2px' }}>Choose your skater</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>3v3 · 3 periods × 3:00 · empty slots filled by bots</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
          maxWidth: 1100,
          width: '100%',
        }}
      >
        {CHARACTERS.map((c) => {
          const isSel = c.id === selected;
          return (
            <button
              key={c.id}
              onClick={() => choose(c.id)}
              style={{
                textAlign: 'left',
                background: isSel ? '#16204a' : '#0f1632',
                border: `2px solid ${isSel ? c.jersey : '#222c52'}`,
                borderRadius: 12,
                padding: 12,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: c.jersey }} />
                <strong>{c.name}</strong>
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, margin: '4px 0 8px', minHeight: 30 }}>{c.blurb}</div>
              {ATTRS.map((a) => (
                <Bar key={a} label={a} value={c.attrs[a]} color={c.jersey} />
              ))}
              <div style={{ fontSize: 11, marginTop: 6 }}>
                <span style={{ opacity: 0.6 }}>ULT: </span>
                {safeUltName(c.ultimateId)}
              </div>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => net.ready()}
        style={{
          marginTop: 18,
          padding: '12px 36px',
          fontSize: 18,
          fontWeight: 800,
          background: '#27c93f',
          border: 'none',
          borderRadius: 10,
          color: '#062',
          cursor: 'pointer',
        }}
      >
        START MATCH ▶
      </button>
    </div>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, margin: '2px 0' }}>
      <span style={{ width: 42, textTransform: 'capitalize', opacity: 0.8 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: '#0a1130', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${value * 10}%`, height: '100%', background: color }} />
      </div>
      <span style={{ width: 16, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function safeUltName(id: string): string {
  try {
    return getUltimate(id).name;
  } catch {
    return id;
  }
}
