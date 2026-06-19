import { useEffect, useState, useSyncExternalStore } from 'react';
import { useUi } from '../store.js';
import {
  controls,
  tokenLabel,
  padLabel,
  ACTION_LABELS,
  MOVE_ACTIONS,
  GAME_ACTIONS,
  type BindableAction,
  type GameAction,
} from '../input/bindings.js';
import { captureGamepadButton } from '../input/gamepad.js';

// What we're currently listening for, if anything.
type Capture =
  | { device: 'key'; action: BindableAction }
  | { device: 'pad'; action: GameAction }
  | null;

const ACCENT = '#4f7cff';
const BORDER = '#2a3566';

export function ControlsPanel() {
  const open = useUi((s) => s.controlsOpen);
  const set = useUi((s) => s.set);
  const bindings = useSyncExternalStore(controls.subscribe, controls.getSnapshot);
  const [capture, setCapture] = useState<Capture>(null);

  // Freeze gameplay input while the panel is open so menu keystrokes don't leak
  // into the live match. Always release on unmount/close.
  useEffect(() => {
    controls.suspended = open;
    if (!open) setCapture(null);
    return () => {
      controls.suspended = false;
    };
  }, [open]);

  // Keyboard / mouse capture. Capture-phase listeners with stopImmediatePropagation
  // beat the game's own window listeners, so the bound key never also acts.
  useEffect(() => {
    if (capture?.device !== 'key') return;
    const action = capture.action;
    const finish = () => setCapture(null);

    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') return finish();
      controls.addKey(action, e.code);
      finish();
    };
    const onMouse = (e: MouseEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      // The click that pairs with this mousedown is still coming; swallow exactly
      // one so it can't reach the backdrop (close) or re-trigger the ＋ button.
      window.addEventListener(
        'click',
        (ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
        },
        { capture: true, once: true },
      );
      controls.addKey(action, `Mouse${e.button}`);
      finish();
    };
    const swallow = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('mousedown', onMouse, true);
    window.addEventListener('contextmenu', swallow, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onMouse, true);
      window.removeEventListener('contextmenu', swallow, true);
    };
  }, [capture]);

  // Gamepad capture.
  useEffect(() => {
    if (capture?.device !== 'pad') return;
    const action = capture.action;
    return captureGamepadButton((index) => {
      controls.bindPad(action, index);
      setCapture(null);
    });
  }, [capture]);

  if (!open) return null;

  const close = () => set({ controlsOpen: false });

  return (
    <div
      onClick={close}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(4,7,18,0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        pointerEvents: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          maxHeight: '86vh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #131c34, #0c1322)',
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          padding: '22px 24px',
          color: '#dfe6ff',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 24, letterSpacing: 1 }}>Controls</h2>
          <button onClick={close} style={iconBtn} title="Close">
            ✕
          </button>
        </div>
        <p style={{ opacity: 0.6, fontSize: 12, marginTop: 6, marginBottom: 16 }}>
          Click <b>＋</b> to add a key/mouse button, a chip’s <b>✕</b> to remove it, or{' '}
          <b>Set</b> to map a gamepad button. Left stick moves, right stick aims, mouse aims.
        </p>

        <Section title="Movement">
          {MOVE_ACTIONS.map((a) => (
            <Row
              key={a}
              action={a}
              tokens={bindings.keyboard[a]}
              padButton={null}
              capture={capture}
              setCapture={setCapture}
            />
          ))}
        </Section>

        <Section title="Actions">
          {GAME_ACTIONS.map((a) => (
            <Row
              key={a}
              action={a}
              tokens={bindings.keyboard[a]}
              padButton={bindings.gamepad[a]}
              capture={capture}
              setCapture={setCapture}
            />
          ))}
        </Section>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
          <button onClick={() => controls.reset()} style={ghostBtn}>
            Reset to defaults
          </button>
          <button onClick={close} style={primaryBtn}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          opacity: 0.5,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({
  action,
  tokens,
  padButton,
  capture,
  setCapture,
}: {
  action: BindableAction;
  tokens: string[];
  padButton: number | null;
  capture: Capture;
  setCapture: (c: Capture) => void;
}) {
  const capturingKey = capture?.device === 'key' && capture.action === action;
  const capturingPad = capture?.device === 'pad' && capture.action === action;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(20,28,52,0.5)',
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        padding: '7px 10px',
      }}
    >
      <div style={{ width: 96, fontSize: 14, fontWeight: 600 }}>{ACTION_LABELS[action]}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, alignItems: 'center' }}>
        {tokens.map((t) => (
          <span key={t} style={chip}>
            {tokenLabel(t)}
            <button
              onClick={() => controls.clearKey(action, t)}
              title="Remove"
              style={chipX}
            >
              ✕
            </button>
          </span>
        ))}
        <button
          onClick={() => setCapture(capturingKey ? null : { device: 'key', action })}
          style={{ ...addBtn, ...(capturingKey ? listeningStyle : null) }}
        >
          {capturingKey ? 'Press a key… (Esc)' : '＋'}
        </button>
      </div>

      {padButton !== null && (
        <button
          onClick={() =>
            setCapture(capturingPad ? null : { device: 'pad', action: action as GameAction })
          }
          title="Map a gamepad button"
          style={{ ...padBtn, ...(capturingPad ? listeningStyle : null) }}
        >
          🎮 {capturingPad ? 'Press…' : padLabel(padButton)}
        </button>
      )}
    </div>
  );
}

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: '#1d2748',
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  padding: '3px 6px',
  fontSize: 12,
  fontWeight: 600,
};

const chipX: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#8c97c9',
  cursor: 'pointer',
  fontSize: 10,
  padding: 0,
  lineHeight: 1,
};

const addBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px dashed ${BORDER}`,
  color: '#aeb8e8',
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 12,
  cursor: 'pointer',
};

const padBtn: React.CSSProperties = {
  background: '#1d2748',
  border: `1px solid ${BORDER}`,
  color: '#dfe6ff',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  minWidth: 78,
};

const listeningStyle: React.CSSProperties = {
  // use the `border` shorthand (not borderColor) to match the base button styles,
  // so toggling capture doesn't mix shorthand/longhand on rerender.
  border: `1px solid ${ACCENT}`,
  color: '#fff',
  boxShadow: `0 0 0 2px rgba(79,124,255,0.35)`,
};

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#8c97c9',
  fontSize: 18,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${BORDER}`,
  color: '#aeb8e8',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 13,
  cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  background: ACCENT,
  border: 'none',
  color: '#fff',
  borderRadius: 8,
  padding: '8px 22px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};
