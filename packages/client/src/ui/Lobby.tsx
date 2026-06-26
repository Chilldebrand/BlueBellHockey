import { useState } from 'react';
import { GAME_MODES, UNIFORM_SCHEMES, normalizeUniformPair, type GameModeId, type UniformSchemeId } from '@bbh/shared';
import { net } from '../net/client.js';
import { sfx } from '../audio/sfx.js';
import { useUi } from '../store.js';

type TeamPref = 0 | 1 | null;
const MODE_IDS = Object.keys(GAME_MODES) as GameModeId[];
const UNIFORM_IDS = Object.keys(UNIFORM_SCHEMES) as UniformSchemeId[];

export function Lobby() {
  const status = useUi((s) => s.status);
  const error = useUi((s) => s.error);
  const set = useUi((s) => s.set);
  const [team, setTeam] = useState<TeamPref>(null);
  const [code, setCode] = useState('');
  const [gameMode, setGameMode] = useState<GameModeId>('regulation');
  const [homeUniform, setHomeUniform] = useState<UniformSchemeId>('blue');
  const [awayUniform, setAwayUniform] = useState<UniformSchemeId>('red');
  const [lockToCharacter, setLockToCharacter] = useState(false);

  const connecting = status === 'connecting';
  const go = (mode: 'quick' | 'create' | 'join') => {
    sfx.init();
    const uniforms = normalizeUniformPair(homeUniform, awayUniform);
    setHomeUniform(uniforms.home);
    setAwayUniform(uniforms.away);
    net.connect({ mode, gameMode, code, team, lockToCharacter, homeUniform: uniforms.home, awayUniform: uniforms.away });
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

      {/* Game mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>Mode</span>
        {MODE_IDS.map((id) => (
          <Seg key={id} label={GAME_MODES[id].name} active={gameMode === id} color="#4f7cff" onClick={() => setGameMode(id)} />
        ))}
      </div>
      <div style={{ fontSize: 12, opacity: 0.55, marginTop: -6, maxWidth: 380, textAlign: 'center' }}>
        {GAME_MODES[gameMode].description}
      </div>

      <UniformPicker
        label="Home"
        value={homeUniform}
        onChange={(id) => {
          const uniforms = normalizeUniformPair(id, awayUniform);
          setHomeUniform(uniforms.home);
          setAwayUniform(uniforms.away);
        }}
      />
      <UniformPicker
        label="Away"
        value={awayUniform}
        onChange={(id) => {
          const uniforms = normalizeUniformPair(homeUniform, id);
          setHomeUniform(uniforms.home);
          setAwayUniform(uniforms.away);
        }}
      />

      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#c7d0ff' }}>
        <input
          type="checkbox"
          checked={lockToCharacter}
          onChange={(e) => setLockToCharacter(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: '#4f7cff' }}
        />
        Lock to selected skater
      </label>

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

function UniformPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: UniformSchemeId;
  onChange: (id: UniformSchemeId) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      <span style={{ fontSize: 13, opacity: 0.7, width: 38 }}>{label}</span>
      {UNIFORM_IDS.map((id) => {
        const scheme = UNIFORM_SCHEMES[id];
        return (
          <button
            key={id}
            aria-label={`${label} ${scheme.name}`}
            onClick={() => onChange(id)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `2px solid ${value === id ? '#ffffff' : '#2a3566'}`,
              background: `linear-gradient(135deg, ${scheme.jersey} 0 58%, ${scheme.pants} 58% 100%)`,
              boxShadow: value === id ? '0 0 0 2px rgba(79,124,255,0.55)' : 'none',
              cursor: 'pointer',
            }}
          />
        );
      })}
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
