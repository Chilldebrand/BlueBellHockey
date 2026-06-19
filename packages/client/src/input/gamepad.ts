import type { PadBindings } from './bindings.js';

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
  const down = (i: number) => !!b[i]?.pressed || (b[i]?.value ?? 0) > 0.5;
  // left/right stick Y is inverted (up = -1) -> map up to +Z (away)
  return {
    connected: true,
    moveX: dz(a[0] ?? 0),
    moveZ: dz(-(a[1] ?? 0)),
    aimX: dz(a[2] ?? 0),
    aimZ: dz(-(a[3] ?? 0)),
    shoot: down(bind.shoot),
    pass: down(bind.pass),
    hit: down(bind.hit),
    steal: down(bind.steal),
    deke: down(bind.deke),
    ult: down(bind.ult),
    poke: down(bind.poke),
  };
}

// Polls connected gamepads and reports the first freshly-pressed button. Buttons
// already held when capture starts are ignored (baseline), so the trigger that
// opened the rebind prompt can't bind itself. Returns a cancel function.
export function captureGamepadButton(onButton: (index: number) => void): () => void {
  let raf = 0;
  let cancelled = false;
  let baseline: boolean[] | null = null;

  const tick = () => {
    if (cancelled) return;
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find((p): p is Gamepad => !!p);
    if (pad) {
      const down = pad.buttons.map((btn) => btn.pressed || btn.value > 0.5);
      if (baseline === null) {
        baseline = down; // first frame: ignore anything already held
      } else {
        for (let i = 0; i < down.length; i++) {
          if (down[i] && !baseline[i]) {
            onButton(i);
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
    cancelAnimationFrame(raf);
  };
}
