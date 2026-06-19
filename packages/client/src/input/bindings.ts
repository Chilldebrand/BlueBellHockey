// Player-customizable control bindings. The input layer (inputManager,
// readGamepad) reads from the `controls` singleton each frame; the rebind UI
// (ControlsPanel) mutates it and React subscribes via useSyncExternalStore.
// Kept framework-free so the per-frame input path never touches React.

export type MoveAction = 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight';
export type GameAction = 'shoot' | 'pass' | 'hit' | 'steal' | 'ult' | 'deke' | 'poke';
export type BindableAction = MoveAction | GameAction;

// A keyboard/mouse binding is a list of tokens. A token is a KeyboardEvent.code
// ("KeyJ", "Space", "ArrowUp") or a mouse button ("Mouse0", "Mouse1", "Mouse2").
// Multiple tokens per action preserve the original dual bindings (WASD + arrows,
// J + left-click, …).
export type KeyBindings = Record<BindableAction, string[]>;

// Gamepad: a standard-mapping button index per game action. Movement/aim stay on
// the sticks (left = move, right = aim), so only the digital actions remap.
export type PadBindings = Record<GameAction, number>;

export interface Bindings {
  keyboard: KeyBindings;
  gamepad: PadBindings;
}

export const MOVE_ACTIONS: MoveAction[] = ['moveUp', 'moveDown', 'moveLeft', 'moveRight'];
export const GAME_ACTIONS: GameAction[] = ['shoot', 'pass', 'hit', 'steal', 'poke', 'ult', 'deke'];

export const ACTION_LABELS: Record<BindableAction, string> = {
  moveUp: 'Move Up',
  moveDown: 'Move Down',
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  shoot: 'Shoot / Slap', // tap = wrist shot, hold = slap shot
  pass: 'Pass',
  hit: 'Hit',
  steal: 'Stick Lift',
  poke: 'Poke Check',
  ult: 'Ultimate',
  deke: 'Deke',
};

// Defaults mirror the previously hardcoded mapping in inputState.ts / gamepad.ts.
export const DEFAULT_BINDINGS: Bindings = {
  keyboard: {
    moveUp: ['KeyW', 'ArrowUp'],
    moveDown: ['KeyS', 'ArrowDown'],
    moveLeft: ['KeyA', 'ArrowLeft'],
    moveRight: ['KeyD', 'ArrowRight'],
    shoot: ['KeyJ', 'Mouse0'],
    pass: ['KeyK', 'Mouse2'],
    hit: ['ShiftLeft', 'KeyL'],
    steal: ['KeyF'], // stick lift
    poke: ['KeyG'], // poke check
    ult: ['Space', 'KeyE'],
    deke: ['KeyQ'],
  },
  gamepad: {
    shoot: 0, // A
    pass: 2, // X
    hit: 5, // RB
    steal: 4, // LB (stick lift)
    poke: 6, // LT (poke check)
    deke: 1, // B
    ult: 7, // RT
  },
};

const MAX_KEYS_PER_ACTION = 3;
const STORAGE_KEY = 'bbh.controls.v1';

function clone(b: Bindings): Bindings {
  return {
    keyboard: Object.fromEntries(
      (Object.keys(b.keyboard) as BindableAction[]).map((a) => [a, [...b.keyboard[a]]]),
    ) as KeyBindings,
    gamepad: { ...b.gamepad },
  };
}

// Merge persisted bindings over the defaults so a binding added in a later
// version still gets a sensible value when an old payload is loaded.
function load(): Bindings {
  const merged = clone(DEFAULT_BINDINGS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return merged;
    const saved = JSON.parse(raw) as Partial<Bindings>;
    if (saved.keyboard) {
      for (const a of Object.keys(merged.keyboard) as BindableAction[]) {
        const tokens = saved.keyboard[a];
        if (Array.isArray(tokens)) {
          merged.keyboard[a] = tokens.filter((t): t is string => typeof t === 'string');
        }
      }
    }
    if (saved.gamepad) {
      for (const a of Object.keys(merged.gamepad) as GameAction[]) {
        const idx = saved.gamepad[a];
        if (typeof idx === 'number' && Number.isInteger(idx)) merged.gamepad[a] = idx;
      }
    }
  } catch {
    return clone(DEFAULT_BINDINGS);
  }
  return merged;
}

class Controls {
  private bindings = load();
  private listeners = new Set<() => void>();

  /** While true (controls menu open) inputManager.gather() yields neutral input,
   *  so menu keystrokes (Space, etc.) don't leak into the live match behind it. */
  suspended = false;

  get keyboard(): KeyBindings {
    return this.bindings.keyboard;
  }
  get gamepad(): PadBindings {
    return this.bindings.gamepad;
  }

  // --- external-store subscription (useSyncExternalStore) ---
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  // Stable reference between changes — commit() swaps in a fresh object only on
  // an actual change, so React won't loop.
  getSnapshot = (): Bindings => this.bindings;

  private commit(next: Bindings): void {
    this.bindings = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private-mode / quota — keep the in-memory bindings anyway */
    }
    this.listeners.forEach((fn) => fn());
  }

  reset(): void {
    this.commit(clone(DEFAULT_BINDINGS));
  }

  /** Add a keyboard token to an action, removing it from every other action so a
   *  single key only ever triggers one thing. No-op if already bound here. */
  addKey(action: BindableAction, token: string): void {
    const next = clone(this.bindings);
    for (const a of Object.keys(next.keyboard) as BindableAction[]) {
      if (a !== action) next.keyboard[a] = next.keyboard[a].filter((t) => t !== token);
    }
    const list = next.keyboard[action];
    if (!list.includes(token)) list.push(token);
    if (list.length > MAX_KEYS_PER_ACTION) list.splice(0, list.length - MAX_KEYS_PER_ACTION);
    this.commit(next);
  }

  clearKey(action: BindableAction, token: string): void {
    const next = clone(this.bindings);
    next.keyboard[action] = next.keyboard[action].filter((t) => t !== token);
    this.commit(next);
  }

  bindPad(action: GameAction, button: number): void {
    const next = clone(this.bindings);
    next.gamepad[action] = button;
    this.commit(next);
  }
}

export const controls = new Controls();

// --- display helpers ---

export function tokenLabel(token: string): string {
  if (token.startsWith('Mouse')) {
    const n = Number(token.slice(5));
    return n === 0 ? 'L-Click' : n === 1 ? 'M-Click' : n === 2 ? 'R-Click' : `Mouse ${n}`;
  }
  if (token.startsWith('Key')) return token.slice(3);
  if (token.startsWith('Digit')) return token.slice(5);
  const arrows: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
  };
  if (token in arrows) return arrows[token];
  const named: Record<string, string> = {
    Space: 'Space',
    ShiftLeft: 'L-Shift',
    ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl',
    ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt',
    AltRight: 'R-Alt',
    Enter: 'Enter',
    Tab: 'Tab',
    Backquote: '`',
  };
  return named[token] ?? token;
}

const PAD_BUTTON_NAMES: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'Back',
  9: 'Start',
  10: 'L3',
  11: 'R3',
  12: 'D-Up',
  13: 'D-Down',
  14: 'D-Left',
  15: 'D-Right',
  16: 'Guide',
};

export function padLabel(index: number): string {
  return PAD_BUTTON_NAMES[index] ?? `Btn ${index}`;
}
