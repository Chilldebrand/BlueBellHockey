/**
 * Static controls reference for the settings overlay: a video-game-style
 * gamepad diagram with callout lines to each button, plus a keyboard/mouse
 * binding list. Bindings mirror input/gamepad.ts, input/keyboard.ts, and
 * input/mouse.ts — update this guide when those mappings change.
 */

interface KeyBinding {
  readonly keys: readonly string[];
  readonly action: string;
}

const KEYBOARD_MOUSE_BINDINGS: readonly KeyBinding[] = [
  { keys: ["W", "A", "S", "D"], action: "Skate (arrow keys work too)" },
  { keys: ["Shift"], action: "Turbo" },
  {
    keys: ["Mouse"],
    action: "Skill stick — flick up: wrist shot · drag down, flick up: slap"
  },
  { keys: ["I", "J", "K", "L"], action: "Skill stick on keys" },
  {
    keys: ["Space"],
    action: "Simple shot — tap: wrist · hold and release: slap"
  },
  {
    keys: ["F"],
    action: "Pass (hold to charge) · switch skater without the puck"
  },
  { keys: ["G"], action: "Body check" },
  { keys: ["R"], action: "Poke check" },
  { keys: ["V"], action: "Dive / block shot" },
  { keys: ["Esc"], action: "Close settings" }
];

/**
 * One callout: dot on the control, hand-routed polyline out to a label.
 * Points are authored so no line crosses a button on the controller art.
 */
interface Callout {
  readonly label: string;
  /** Polyline waypoints; the first point gets the dot on the control. */
  readonly points: readonly (readonly [number, number])[];
  /** Label anchor position. */
  readonly labelAt: readonly [number, number];
  readonly anchor: "start" | "end";
}

const CALLOUTS: readonly Callout[] = [
  {
    label: "LB · Dive / block shot",
    points: [
      [270, 88],
      [152, 88]
    ],
    labelAt: [10, 88],
    anchor: "start"
  },
  {
    label: "Left stick · Skate",
    points: [
      [247, 140],
      [152, 140]
    ],
    labelAt: [10, 140],
    anchor: "start"
  },
  {
    label: "Click (L3) · Turbo",
    points: [
      [262, 150],
      [200, 164],
      [152, 164]
    ],
    labelAt: [10, 164],
    anchor: "start"
  },
  {
    label: "RT · Pass (hold to charge)",
    points: [
      [412, 62],
      [502, 70],
      [512, 70]
    ],
    labelAt: [670, 70],
    anchor: "end"
  },
  {
    label: "RB · Poke check",
    points: [
      [400, 86],
      [502, 92],
      [512, 92]
    ],
    labelAt: [670, 92],
    anchor: "end"
  },
  {
    label: "Y · (unused)",
    points: [
      [415, 112],
      [502, 116],
      [512, 116]
    ],
    labelAt: [670, 116],
    anchor: "end"
  },
  {
    label: "B · Shoulder check",
    points: [
      [439, 140],
      [512, 140]
    ],
    labelAt: [670, 140],
    anchor: "end"
  },
  {
    label: "A · Pass / switch skater",
    points: [
      [416, 167],
      [502, 164],
      [512, 164]
    ],
    labelAt: [670, 164],
    anchor: "end"
  },
  {
    label: "X · Hip check",
    points: [
      [387, 150],
      [387, 172],
      [502, 188],
      [512, 188]
    ],
    labelAt: [670, 188],
    anchor: "end"
  },
  {
    label: "Right stick · Skill stick",
    points: [
      [400, 196],
      [502, 220],
      [512, 220]
    ],
    labelAt: [670, 220],
    anchor: "end"
  }
];

function GamepadDiagram(): JSX.Element {
  return (
    <svg
      className="controls-gamepad"
      viewBox="0 0 680 300"
      role="img"
      aria-label="Gamepad control diagram"
    >
      {/* triggers, peeking above the bumpers */}
      <g fill="#101a2c" stroke="rgba(234, 243, 255, 0.35)" strokeWidth="1.5">
        <rect x="256" y="60" width="24" height="20" rx="7" />
        <rect x="400" y="60" width="24" height="20" rx="7" />
      </g>

      {/* bumpers, following the shoulder curve */}
      <g fill="#101a2c" stroke="rgba(234, 243, 255, 0.35)" strokeWidth="1.5">
        <path d="M 246 100 C 270 84 302 78 322 80 L 322 91 C 302 89 272 92 252 104 Z" />
        <path d="M 434 100 C 410 84 378 78 358 80 L 358 91 C 378 89 408 92 428 104 Z" />
      </g>

      {/* trigger + bumper labels */}
      <g
        fill="rgba(234, 243, 255, 0.75)"
        fontFamily="inherit"
        fontSize="9"
        fontWeight="700"
        textAnchor="middle"
      >
        <text x="268" y="73.5">LT</text>
        <text x="412" y="73.5">RT</text>
        <text x="292" y="92">LB</text>
        <text x="388" y="92">RB</text>
      </g>

      {/* Xbox-style body: wide shoulders, angled grips */}
      <path
        d="M 340 96
           C 310 96 285 99 262 106
           C 240 112 224 124 214 144
           C 202 168 194 204 190 236
           C 187 262 192 280 208 286
           C 224 292 240 280 252 260
           C 262 243 274 232 292 232
           L 388 232
           C 406 232 418 243 428 260
           C 440 280 456 292 472 286
           C 488 280 493 262 490 236
           C 486 204 478 168 466 144
           C 456 124 440 112 418 106
           C 395 99 370 96 340 96
           Z"
        fill="#0c1422"
        stroke="rgba(234, 243, 255, 0.3)"
        strokeWidth="1.5"
      />

      {/* guide button */}
      <g>
        <circle
          cx="340"
          cy="112"
          r="12"
          fill="#101a2c"
          stroke="#35c86a"
          strokeWidth="1.5"
        />
        <circle cx="340" cy="112" r="6" fill="none" stroke="rgba(53, 200, 106, 0.5)" />
      </g>

      {/* view / menu buttons */}
      <g fill="#101a2c" stroke="rgba(234, 243, 255, 0.35)">
        <circle cx="308" cy="144" r="5.5" />
        <circle cx="372" cy="144" r="5.5" />
      </g>

      {/* left stick (upper left) */}
      <g>
        <circle
          cx="272"
          cy="140"
          r="25"
          fill="#101a2c"
          stroke="rgba(234, 243, 255, 0.4)"
          strokeWidth="1.5"
        />
        <circle cx="272" cy="140" r="14" fill="#1d2b42" stroke="#4ea3ff" />
      </g>

      {/* d-pad dish (lower middle-left, unused) */}
      <g>
        <circle
          cx="302"
          cy="196"
          r="17"
          fill="#101a2c"
          stroke="rgba(234, 243, 255, 0.2)"
        />
        <g fill="#1d2b42" stroke="rgba(234, 243, 255, 0.3)">
          <rect x="297" y="182" width="10" height="28" rx="3" />
          <rect x="288" y="191" width="28" height="10" rx="3" />
        </g>
      </g>

      {/* right stick (lower middle-right) */}
      <g>
        <circle
          cx="378"
          cy="196"
          r="22"
          fill="#101a2c"
          stroke="rgba(234, 243, 255, 0.4)"
          strokeWidth="1.5"
        />
        <circle cx="378" cy="196" r="12" fill="#1d2b42" stroke="#ff6f7b" />
      </g>

      {/* face buttons (upper right): Y top, X left, B right, A bottom */}
      <g fontFamily="inherit" fontSize="10" fontWeight="700">
        <circle cx="408" cy="119" r="9.5" fill="#101a2c" stroke="#e2c54f" />
        <text x="408" y="122.5" textAnchor="middle" fill="#e2c54f">
          Y
        </text>
        <circle cx="387" cy="140" r="9.5" fill="#101a2c" stroke="#4ea3ff" />
        <text x="387" y="143.5" textAnchor="middle" fill="#4ea3ff">
          X
        </text>
        <circle cx="429" cy="140" r="9.5" fill="#101a2c" stroke="#ff6f7b" />
        <text x="429" y="143.5" textAnchor="middle" fill="#ff6f7b">
          B
        </text>
        <circle cx="408" cy="161" r="9.5" fill="#101a2c" stroke="#35c86a" />
        <text x="408" y="164.5" textAnchor="middle" fill="#35c86a">
          A
        </text>
      </g>

      {/* callout lines + labels */}
      <g>
        {CALLOUTS.map((callout) => {
          const [dotX, dotY] = callout.points[0]!;
          const [labelX, labelY] = callout.labelAt;

          return (
            <g key={callout.label}>
              <circle cx={dotX} cy={dotY} r="2.5" fill="#ffdf6e" />
              <polyline
                points={callout.points
                  .map(([x, y]) => `${x},${y}`)
                  .join(" ")}
                fill="none"
                stroke="rgba(255, 223, 110, 0.45)"
                strokeWidth="1"
              />
              <text
                x={labelX}
                y={labelY + 3.5}
                textAnchor={callout.anchor}
                fill="#eaf3ff"
                fontSize="11"
                letterSpacing="0.5"
              >
                {callout.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function ControlsGuide(): JSX.Element {
  return (
    <section className="controls-guide" aria-label="Controls">
      <h2>Controls</h2>

      <h3>Gamepad</h3>
      <GamepadDiagram />
      <ul className="controls-notes">
        <li>
          Skill stick: flick up = wrist shot (a hit attempt without the puck),
          pull back then flick up = slap shot, sweep = stickhandle.
        </li>
        <li>Powerups fire automatically when you skate over them.</li>
      </ul>

      <h3>Keyboard &amp; mouse</h3>
      <ul className="controls-key-list">
        {KEYBOARD_MOUSE_BINDINGS.map((binding) => (
          <li key={binding.action}>
            <span className="controls-keys">
              {binding.keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </span>
            <span className="controls-action">{binding.action}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
