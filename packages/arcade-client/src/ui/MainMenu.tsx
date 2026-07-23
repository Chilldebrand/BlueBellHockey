import { useCallback, useEffect, useRef, useState } from "react";

export interface MainMenuProps {
  readonly onQuickMatch: () => void;
  readonly onPrivateRoom: () => void;
  readonly onFreeSkate?: () => void;
  readonly onOpenSettings?: () => void;
  /** Suspend menu keyboard/gamepad handling (e.g. while an overlay is open). */
  readonly inputLocked?: boolean;
}

interface MenuItem {
  readonly key: string;
  readonly label: string;
  readonly action: () => void;
  readonly muted?: boolean;
}

const GAMEPAD_POLL_MS = 120;
const GAMEPAD_ACCEPT_BUTTONS = [0, 9]; // A, Start
const GAMEPAD_DPAD_UP = 12;
const GAMEPAD_DPAD_DOWN = 13;
const STICK_MENU_THRESHOLD = 0.5;

export function MainMenu({
  onQuickMatch,
  onPrivateRoom,
  onFreeSkate,
  onOpenSettings,
  inputLocked = false
}: MainMenuProps): JSX.Element {
  const items: MenuItem[] = [
    { key: "quick-match", label: "Quick Match", action: onQuickMatch },
    { key: "private-room", label: "Private Room", action: onPrivateRoom }
  ];
  if (onFreeSkate) {
    items.push({ key: "free-skate", label: "Free Skate", action: onFreeSkate });
  }

  if (onOpenSettings) {
    items.push({
      key: "settings",
      label: "Settings",
      action: onOpenSettings,
      muted: true
    });
  }

  const [focusIndex, setFocusIndex] = useState(0);
  const safeFocusIndex = Math.min(focusIndex, items.length - 1);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const focusRef = useRef(safeFocusIndex);
  focusRef.current = safeFocusIndex;

  // focusRef updates eagerly (not just on re-render) so a move + activate
  // arriving in the same frame can't fire the previously focused item.
  const setFocus = useCallback((index: number) => {
    focusRef.current = index;
    setFocusIndex(index);
  }, []);

  const moveFocus = useCallback(
    (delta: number) => {
      const count = itemsRef.current.length;
      const next =
        (Math.min(focusRef.current, count - 1) + delta + count) % count;
      setFocus(next);
    },
    [setFocus]
  );

  const activateFocused = useCallback(() => {
    itemsRef.current[focusRef.current]?.action();
  }, []);

  useEffect(() => {
    if (inputLocked) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      switch (event.code) {
        case "ArrowUp":
        case "KeyW":
          event.preventDefault();
          moveFocus(-1);
          break;
        case "ArrowDown":
        case "KeyS":
          event.preventDefault();
          moveFocus(1);
          break;
        case "Enter":
        case "NumpadEnter":
        case "Space":
          event.preventDefault();
          activateFocused();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputLocked, moveFocus, activateFocused]);

  useEffect(() => {
    if (inputLocked) {
      return;
    }

    // D-pad / left stick move the focus bar, A (or Start) activates.
    // Rising-edge only, primed by the first sample, so buttons already held
    // when the menu mounts (Start on the splash) don't fire immediately.
    let primed = false;
    let wasUp = false;
    let wasDown = false;
    let wasAccept = false;
    const intervalId = window.setInterval(() => {
      const pads = navigator.getGamepads?.() ?? [];
      let up = false;
      let down = false;
      let accept = false;
      for (const pad of pads) {
        if (!pad) {
          continue;
        }

        const axisY = pad.axes[1] ?? 0;
        up =
          up ||
          pad.buttons[GAMEPAD_DPAD_UP]?.pressed === true ||
          axisY < -STICK_MENU_THRESHOLD;
        down =
          down ||
          pad.buttons[GAMEPAD_DPAD_DOWN]?.pressed === true ||
          axisY > STICK_MENU_THRESHOLD;
        accept =
          accept ||
          GAMEPAD_ACCEPT_BUTTONS.some(
            (button) => pad.buttons[button]?.pressed === true
          );
      }

      if (primed) {
        if (up && !wasUp) {
          moveFocus(-1);
        }

        if (down && !wasDown) {
          moveFocus(1);
        }

        if (accept && !wasAccept) {
          activateFocused();
        }
      }

      primed = true;
      wasUp = up;
      wasDown = down;
      wasAccept = accept;
    }, GAMEPAD_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [inputLocked, moveFocus, activateFocused]);

  return (
    <main className="menu-screen main-menu">
      <div className="menu-screen-bg" />
      <div className="menu-screen-scrim" />
      <div className="menu-screen-content">
        <h1>BBH Arcade</h1>
        {items.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={[
              "menu-panel-button",
              "main-menu-item",
              index === safeFocusIndex ? "is-focused" : "",
              item.muted ? "is-muted" : ""
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={item.action}
            onMouseEnter={() => setFocus(index)}
            onFocus={() => setFocus(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </main>
  );
}
