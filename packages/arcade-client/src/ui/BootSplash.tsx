import { useEffect, useRef } from "react";

const GAMEPAD_POLL_MS = 120;
const GAMEPAD_START_BUTTON = 9;

export function BootSplash({
  onContinue
}: {
  readonly onContinue: () => void;
}): JSX.Element {
  const firedRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  const fire = (): void => {
    if (firedRef.current) {
      return;
    }

    firedRef.current = true;
    onContinueRef.current();
  };

  const fireRef = useRef(fire);
  fireRef.current = fire;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.code === "Enter" ||
        event.code === "NumpadEnter" ||
        event.code === "Space"
      ) {
        event.preventDefault();
        fireRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    // Gamepad Start also advances. Rising-edge only, primed by the first
    // sample, so a Start button already held when this screen mounts (or a
    // browser without gamepad support) never auto-skips the splash.
    let primed = false;
    let wasPressed = false;
    const intervalId = window.setInterval(() => {
      const pads = navigator.getGamepads?.() ?? [];
      let pressed = false;
      for (const pad of pads) {
        if (pad?.buttons[GAMEPAD_START_BUTTON]?.pressed === true) {
          pressed = true;
        }
      }

      if (primed && pressed && !wasPressed) {
        fireRef.current();
      }

      primed = true;
      wasPressed = pressed;
    }, GAMEPAD_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <main className="menu-screen boot-screen">
      <div className="menu-screen-bg" />
      <div className="menu-screen-scrim" />
      <div className="menu-screen-content">
        <div className="boot-wordmark">
          <h1>BBH Arcade</h1>
          <div className="boot-wordmark-bar" />
          <p className="boot-tagline">Original 3v3 Arcade Hockey</p>
        </div>
        <button
          type="button"
          className="menu-panel-button boot-start-button"
          onClick={fire}
        >
          Press Start
        </button>
      </div>
    </main>
  );
}
