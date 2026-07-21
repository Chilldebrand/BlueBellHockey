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

/** One callout: dot on the control, elbow line out to a label. */
interface Callout {
  readonly label: string;
  /** Dot on the control [x, y]. */
  readonly at: readonly [number, number];
  /** Label anchor [x, y]; side decides text-anchor and line direction. */
  readonly to: readonly [number, number];
  readonly side: "left" | "right";
}

const CALLOUTS: readonly Callout[] = [
  { label: "LB · Dive / block shot", at: [262, 96], to: [10, 96], side: "left" },
  { label: "Left stick · Skate", at: [254, 158], to: [10, 150], side: "left" },
  { label: "Click (L3) · Turbo", at: [268, 176], to: [10, 172], side: "left" },
  { label: "RT · Pass (hold to charge)", at: [404, 78], to: [670, 78], side: "right" },
  { label: "RB · Poke check", at: [418, 96], to: [670, 100], side: "right" },
  { label: "Y · (unused)", at: [424, 130], to: [670, 126], side: "right" },
  { label: "B · Shoulder check", at: [446, 152], to: [670, 150], side: "right" },
  { label: "X · Hip check", at: [402, 152], to: [670, 174], side: "right" },
  { label: "A · Pass / switch skater", at: [424, 174], to: [670, 198], side: "right" },
  {
    label: "Right stick · Skill stick",
    at: [394, 222],
    to: [670, 234],
    side: "right"
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
      {/* controller body: center slab + two grips */}
      <g fill="#0c1422" stroke="rgba(234, 243, 255, 0.3)" strokeWidth="1.5">
        <circle cx="262" cy="196" r="52" />
        <circle cx="418" cy="196" r="52" />
        <rect x="240" y="112" width="200" height="118" rx="46" />
        {/* seam cleanup: redraw the middle without a stroke through the grips */}
        <rect
          x="252"
          y="114"
          width="176"
          height="114"
          rx="44"
          stroke="none"
        />
      </g>

      {/* bumpers + right trigger */}
      <g fill="#101a2c" stroke="rgba(234, 243, 255, 0.35)" strokeWidth="1.5">
        <path d="M 236 100 q 26 -14 56 -10 l 0 12 l -56 4 z" />
        <path d="M 444 100 q -26 -14 -56 -10 l 0 12 l 56 4 z" />
        <rect x="392" y="72" width="34" height="12" rx="6" />
      </g>

      {/* left stick */}
      <g>
        <circle
          cx="266"
          cy="164"
          r="24"
          fill="#101a2c"
          stroke="rgba(234, 243, 255, 0.4)"
          strokeWidth="1.5"
        />
        <circle cx="266" cy="164" r="13" fill="#1d2b42" stroke="#4ea3ff" />
      </g>

      {/* d-pad (unused, drawn for realism) */}
      <g fill="#101a2c" stroke="rgba(234, 243, 255, 0.25)">
        <rect x="296" y="196" width="12" height="34" rx="3" />
        <rect x="285" y="207" width="34" height="12" rx="3" />
      </g>

      {/* right stick */}
      <g>
        <circle
          cx="374"
          cy="212"
          r="24"
          fill="#101a2c"
          stroke="rgba(234, 243, 255, 0.4)"
          strokeWidth="1.5"
        />
        <circle cx="374" cy="212" r="13" fill="#1d2b42" stroke="#ff6f7b" />
      </g>

      {/* face buttons: Y top, X left, B right, A bottom */}
      <g fontFamily="inherit" fontSize="11" fontWeight="700">
        <circle cx="424" cy="134" r="10" fill="#101a2c" stroke="#e2c54f" />
        <text x="424" y="138" textAnchor="middle" fill="#e2c54f">
          Y
        </text>
        <circle cx="402" cy="156" r="10" fill="#101a2c" stroke="#4ea3ff" />
        <text x="402" y="160" textAnchor="middle" fill="#4ea3ff">
          X
        </text>
        <circle cx="446" cy="156" r="10" fill="#101a2c" stroke="#ff6f7b" />
        <text x="446" y="160" textAnchor="middle" fill="#ff6f7b">
          B
        </text>
        <circle cx="424" cy="178" r="10" fill="#101a2c" stroke="#35c86a" />
        <text x="424" y="182" textAnchor="middle" fill="#35c86a">
          A
        </text>
      </g>

      {/* callout lines + labels */}
      <g>
        {CALLOUTS.map((callout) => {
          const [ax, ay] = callout.at;
          const [tx, ty] = callout.to;
          const elbowX = callout.side === "left" ? tx + 118 : tx - 168;

          return (
            <g key={callout.label}>
              <circle cx={ax} cy={ay} r="2.5" fill="#ffdf6e" />
              <polyline
                points={`${ax},${ay} ${elbowX},${ty} ${
                  callout.side === "left" ? tx + 108 : tx - 158
                },${ty}`}
                fill="none"
                stroke="rgba(255, 223, 110, 0.45)"
                strokeWidth="1"
              />
              <text
                x={tx}
                y={ty + 3.5}
                textAnchor={callout.side === "left" ? "start" : "end"}
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
