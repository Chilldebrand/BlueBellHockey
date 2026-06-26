import type { PadBinding, PadBindings } from './bindings.js';

export interface GamepadReading {
  connected: boolean;
  moveX: number;
  moveZ: number;
  aimX: number;
  aimZ: number;
  shoot: boolean;
  pass: boolean;
  hit: boolean;
  steal: boolean;
  ult: boolean;
  deke: boolean;
  poke: boolean;
  sprint: boolean;
  switchPlayer: boolean;
  hitGesture: boolean;
}

const DEAD = 0.18;
function dz(x: number): number {
  return Math.abs(x) < DEAD ? 0 : x;
}

const DISCONNECTED: GamepadReading = {
  connected: false,
  moveX: 0,
  moveZ: 0,
  aimX: 0,
  aimZ: 0,
  shoot: false,
  pass: false,
  hit: false,
  steal: false,
  ult: false,
  deke: false,
  poke: false,
  sprint: false,
  switchPlayer: false,
  hitGesture: false,
};

// Standard-mapping gamepad: left stick move, right stick aim. The digital
// actions read whichever button index the player has bound; treating a button as
// "down" on pressed OR value > 0.5 also covers the analog triggers (LT/RT).
export function readGamepad(bind: PadBindings): GamepadReading {
  const pads = navigator.getGamepads?.() ?? [];
  const pad = pads.find((p): p is Gamepad => !!p);
  if (!pad) return DISCONNECTED;

  const a = pad.axes;
  const b = pad.buttons;
  const buttonDown = (i: number) => !!b[i]?.pressed || (b[i]?.value ?? 0) > 0.5;
  const isChord = (binding: PadBinding): binding is { all: number[] } =>
    !!binding && typeof binding === 'object' && !Array.isArray(binding);
  const down = (binding: PadBinding) => {
    if (binding && typeof binding === 'object' && !Array.isArray(binding)) {
      return binding.all.every(buttonDown);
    }
    const indices = Array.isArray(binding) ? binding : binding === null ? [] : [binding];
    return indices.some(buttonDown);
  };
  const ultDown = down(bind.ult);
  const chordButtons = isChord(bind.ult) && ultDown ? new Set(bind.ult.all) : null;
  const actionDown = (binding: PadBinding) => {
    if (chordButtons && !isChord(binding)) {
      const indices = Array.isArray(binding) ? binding : binding === null ? [] : [binding];
      if (indices.some((i) => chordButtons.has(i))) return false;
    }
    return down(binding);
  };
  // left/right stick Y is inverted (up = -1) -> map up to +Z (away)
  return {
    connected: true,
    moveX: dz(a[0] ?? 0),
    moveZ: dz(-(a[1] ?? 0)),
    aimX: dz(a[2] ?? 0),
    aimZ: dz(-(a[3] ?? 0)),
    shoot: actionDown(bind.shoot),
    pass: actionDown(bind.pass),
    hit: actionDown(bind.hit),
    steal: actionDown(bind.steal),
    deke: actionDown(bind.deke),
    ult: ultDown,
    poke: actionDown(bind.poke),
    sprint: actionDown(bind.sprint),
    switchPlayer: actionDown(bind.switchPlayer),
    hitGesture: dz(-(a[3] ?? 0)) > 0.65,
  };
}

// Polls connected gamepads and reports the first freshly-pressed button. Buttons
// already held when capture starts are ignored (baseline), so the trigger that
// opened the rebind prompt can't bind itself. Returns a cancel function.
export function captureGamepadButton(onButton: (binding: PadBinding) => void): () => void {
  let raf = 0;
  let cancelled = false;
  let baseline: boolean[] | null = null;
  let chordTimer = 0;

  const currentDown = (): number[] => {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find((p): p is Gamepad => !!p);
    if (!pad) return [];
    return pad.buttons
      .map((btn, index) => (btn.pressed || btn.value > 0.5 ? index : -1))
      .filter((index) => index >= 0);
  };

  const finish = (firstIndex: number) => {
    chordTimer = window.setTimeout(() => {
      const held = currentDown();
      onButton(held.length > 1 ? { all: held } : firstIndex);
    }, 120);
  };

  const tick = () => {
    if (cancelled || chordTimer) return;
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find((p): p is Gamepad => !!p);
    if (pad) {
      const down = pad.buttons.map((btn) => btn.pressed || btn.value > 0.5);
      if (baseline === null) {
        baseline = down; // first frame: ignore anything already held
      } else {
        for (let i = 0; i < down.length; i++) {
          if (down[i] && !baseline[i]) {
            finish(i);
            return; // stop polling (no further rAF scheduled)
          }
          if (!down[i]) baseline[i] = false; // allow a re-press of a released button
        }
      }
    }
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    if (chordTimer) window.clearTimeout(chordTimer);
    cancelAnimationFrame(raf);
  };
}
