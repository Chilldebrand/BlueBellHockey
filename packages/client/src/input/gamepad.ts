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
}

const DEAD = 0.18;
function dz(x: number): number {
  return Math.abs(x) < DEAD ? 0 : x;
}

// Standard-mapping gamepad: left stick move, right stick aim,
// A=shoot, X=pass, RB=hit, LB/B=steal, RT=ult.
export function readGamepad(): GamepadReading {
  const pads = navigator.getGamepads?.() ?? [];
  const pad = pads.find((p): p is Gamepad => !!p);
  if (!pad) {
    return {
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
    };
  }
  const a = pad.axes;
  const b = pad.buttons;
  const pressed = (i: number) => !!b[i]?.pressed;
  // left/right stick Y is inverted (up = -1) -> map up to +Z (away)
  return {
    connected: true,
    moveX: dz(a[0] ?? 0),
    moveZ: dz(-(a[1] ?? 0)),
    aimX: dz(a[2] ?? 0),
    aimZ: dz(-(a[3] ?? 0)),
    shoot: pressed(0), // A
    pass: pressed(2), // X
    hit: pressed(5), // RB
    steal: pressed(4) || pressed(1), // LB or B
    ult: (b[7]?.value ?? 0) > 0.5, // RT
  };
}
