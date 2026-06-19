import { useState } from 'react';
import { CHARACTERS, getUltimate, type AttributeKey } from '@bbh/shared';
import { net } from '../net/client.js';
import { useUi } from '../store.js';
import { CharacterPreview } from '../render/CharacterPreview.js';

const ATTRS: AttributeKey[] = ['speed', 'hit', 'steal', 'shoot', 'pass'];

function ult(id: string): { name: string; description: string } {
  try {
    const u = getUltimate(id);
    return { name: u.name, description: u.description };
  } catch {
    return { name: id, description: '' };
  }
}

export function CharacterSelect() {
  const selected = useUi((s) => s.selectedCharacter);
  const set = useUi((s) => s.set);
  const roomCode = useUi((s) => s.roomCode);
  const myTeam = useUi((s) => s.myTeam);
  const [hover, setHover] = useState<string | null>(null);

  const choose = (id: string) => {
    set({ selectedCharacter: id });
    net.selectCharacter(id);
  };

  // the hero panel shows whatever you're hovering, falling back to your pick
  const shownId = hover ?? selected;
  const shown = CHARACTERS.find((c) => c.id === shownId) ?? CHARACTERS[0];
  const shownUlt = ult(shown.ultimateId);

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

      {(roomCode || myTeam !== null) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 12,
            padding: '6px 16px',
            borderRadius: 10,
            background: 'rgba(20,28,52,0.6)',
            border: '1px solid #2a3566',
            fontSize: 13,
          }}
        >
          {roomCode ? (
            <span>
              <span style={{ opacity: 0.6 }}>Room code </span>
              <b style={{ fontSize: 18, letterSpacing: 3, color: '#ffd23c' }}>{roomCode}</b>
              <span style={{ opacity: 0.6 }}> · share to invite friends</span>
            </span>
          ) : (
            <span style={{ opacity: 0.6 }}>Public match</span>
          )}
          {myTeam !== null && (
            <span style={{ color: myTeam === 0 ? '#3c6bff' : '#ff5a3c', fontWeight: 700 }}>
              You’re on {myTeam === 0 ? 'HOME' : 'AWAY'}
            </span>
          )}
        </div>
      )}

      {/* Hero: idle 3D preview + the shown skater's build and ultimate */}
      <div
        style={{
          display: 'flex',
          gap: 18,
          alignItems: 'stretch',
          maxWidth: 1100,
          width: '100%',
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: 240,
            height: 300,
            flex: '0 0 auto',
            borderRadius: 14,
            overflow: 'hidden',
            border: `2px solid ${shown.jersey}`,
            background: '#0a0e20',
          }}
        >
          <CharacterPreview glb={shown.glb} team={0} jersey={shown.jersey} />
        </div>

        <div style={{ flex: '1 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, background: shown.jersey }} />
            <h2 style={{ margin: 0, fontSize: 32 }}>{shown.name}</h2>
            {shown.id === selected && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#27c93f', border: '1px solid #27c93f', borderRadius: 12, padding: '2px 10px' }}>
                SELECTED
              </span>
            )}
          </div>
          <div style={{ opacity: 0.8, fontSize: 14, marginBottom: 4 }}>{shown.blurb}</div>
          <div style={{ maxWidth: 420 }}>
            {ATTRS.map((a) => (
              <Bar key={a} label={a} value={shown.attrs[a]} color={shown.jersey} big />
            ))}
          </div>
          <div
            style={{
              marginTop: 8,
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255,210,60,0.08)',
              border: '1px solid rgba(255,210,60,0.35)',
            }}
          >
            <div style={{ fontWeight: 800, color: '#ffd23c', letterSpacing: 0.5 }}>
              ⚡ {shownUlt.name}
            </div>
            <div style={{ fontSize: 13, opacity: 0.9, marginTop: 3 }}>{shownUlt.description}</div>
          </div>
        </div>
      </div>

      <div
        onMouseLeave={() => setHover(null)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
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
              onMouseEnter={() => setHover(c.id)}
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
              {ATTRS.map((a) => (
                <Bar key={a} label={a} value={c.attrs[a]} color={c.jersey} />
              ))}
              <div style={{ fontSize: 11, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ opacity: 0.6 }}>ULT: </span>
                {ult(c.ultimateId).name}
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

function Bar({ label, value, color, big }: { label: string; value: number; color: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: big ? 12 : 11, margin: big ? '3px 0' : '2px 0' }}>
      <span style={{ width: big ? 46 : 42, textTransform: 'capitalize', opacity: 0.8 }}>{label}</span>
      <div style={{ flex: 1, height: big ? 10 : 8, background: '#0a1130', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${value * 10}%`, height: '100%', background: color }} />
      </div>
      <span style={{ width: 16, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
