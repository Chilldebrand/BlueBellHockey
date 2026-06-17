import { net } from '../net/client.js';
import { useUi } from '../store.js';

export function Lobby() {
  const status = useUi((s) => s.status);
  const error = useUi((s) => s.error);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'radial-gradient(circle at 50% 30%, #16204a, #06091a)',
      }}
    >
      <h1 style={{ fontSize: 52, margin: 0, letterSpacing: 1 }}>BBellHockey</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>Online 3v3 Arcade Hockey</p>
      {status === 'error' && <p style={{ color: '#ff6b6b' }}>Connection failed: {error}</p>}
      <button
        disabled={status === 'connecting'}
        onClick={() => net.connect()}
        style={{
          padding: '14px 44px',
          fontSize: 20,
          fontWeight: 800,
          background: status === 'connecting' ? '#445' : '#4f7cff',
          border: 'none',
          borderRadius: 12,
          color: '#fff',
          cursor: 'pointer',
        }}
      >
        {status === 'connecting' ? 'Connecting…' : 'PLAY'}
      </button>
    </div>
  );
}
