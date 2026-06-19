import { useState } from 'react';
import { net } from '../net/client.js';
import { sfx } from '../audio/sfx.js';
import { useUi } from '../store.js';

type TeamPref = 0 | 1 | null;

export function Lobby() {
  const status = useUi((s) => s.status);
  const error = useUi((s) => s.error);
  const set = useUi((s) => s.set);
  const [team, setTeam] = useState<TeamPref>(null);
  const [code, setCode] = useState('');

  const connecting = status === 'connecting';
  const go = (mode: 'quick' | 'create' | 'join') => {
    sfx.init();
    net.connect({ mode, code, team });
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: 'radial-gradient(circle at 50% 30%, #16204a, #06091a)',
      }}
    >
      <h1 style={{ fontSize: 52, margin: 0, letterSpacing: 1 }}>BBellHockey</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>Online 3v3 Arcade Hockey</p>
      {status === 'error' && <p style={{ color: '#ff6b6b', margin: 0 }}>Connection failed: {error}</p>}

      {/* Team preference */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>Team</span>
        <Seg label="Auto" active={team === null} color="#9aa6d6" onClick={() => setTeam(null)} />
        <Seg label="Home" active={team === 0} color="#3c6bff" onClick={() => setTeam(0)} />
        <Seg label="Away" active={team === 1} color="#ff5a3c" onClick={() => setTeam(1)} />
      </div>

      <button disabled={connecting} onClick={() => go('quick')} style={primaryBtn(connecting)}>
        {connecting ? 'Connecting…' : 'QUICK PLAY'}
      </button>

      {/* Friend lobbies */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ROOM CODE"
          maxLength={6}
          style={{
            width: 130,
            background: '#0d1430',
            border: '1px solid #2a3566',
            borderRadius: 10,
            color: '#dfe6ff',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 3,
            textAlign: 'center',
            padding: '0 10px',
          }}
        />
        <button
          disabled={connecting || code.length < 3}
          onClick={() => go('join')}
          style={secondaryBtn(connecting || code.length < 3)}
        >
          JOIN
        </button>
      </div>
      <button disabled={connecting} onClick={() => go('create')} style={ghostBtn(connecting)}>
        ✦ Create private room
      </button>

      <button onClick={() => set({ controlsOpen: true })} style={settingsBtn}>
        ⚙ Settings
      </button>
    </div>
  );
}

function Seg({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px',
        fontSize: 13,
        fontWeight: 700,
        background: active ? color : 'transparent',
        border: `1px solid ${active ? color : '#2a3566'}`,
        borderRadius: 8,
        color: active ? '#fff' : '#aeb8e8',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '14px 44px',
    fontSize: 20,
    fontWeight: 800,
    background: disabled ? '#445' : '#4f7cff',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    cursor: disabled ? 'default' : 'pointer',
  };
}
function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '0 22px',
    fontSize: 15,
    fontWeight: 800,
    background: disabled ? '#2a3354' : '#27c93f',
    border: 'none',
    borderRadius: 10,
    color: disabled ? '#8c97c9' : '#062',
    cursor: disabled ? 'default' : 'pointer',
  };
}
function ghostBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 22px',
    fontSize: 14,
    fontWeight: 600,
    background: 'transparent',
    border: '1px solid #2a3566',
    borderRadius: 10,
    color: disabled ? '#5a648c' : '#aeb8e8',
    cursor: disabled ? 'default' : 'pointer',
  };
}
const settingsBtn: React.CSSProperties = {
  padding: '8px 22px',
  fontSize: 14,
  fontWeight: 600,
  background: 'transparent',
  border: '1px solid #2a3566',
  borderRadius: 10,
  color: '#aeb8e8',
  cursor: 'pointer',
  marginTop: 6,
};
