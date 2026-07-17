import { describe, expect, it, vi } from "vitest";
import { DEFAULT_AUDIO_PREFERENCES } from "../audio/preferences.js";

const keyboardListeners = new Map<
  string,
  Set<
    (event: {
      key: string;
      type?: string;
      target?: { tagName?: string };
      preventDefault?: () => void;
      stopPropagation?: () => void;
    }) => void
  >
>();

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();

  return {
    ...react,
    useEffect: (effect: () => void | (() => void)) => {
      effect();
    },
    useRef: <T,>(initial: T) => ({ current: initial })
  };
});

import { SettingsOverlay } from "./SettingsOverlay.js";

function withFakeDocument(run: () => void): void {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const activeElement = { focus: vi.fn() };
  const fakeDocument = {
    activeElement,
    addEventListener: vi.fn(
      (
        type: string,
        listener: (event: {
          key: string;
          type?: string;
          target?: { tagName?: string };
          preventDefault?: () => void;
          stopPropagation?: () => void;
        }) => void
      ) => {
        const bucket = keyboardListeners.get(type) ?? new Set();
        bucket.add(listener);
        keyboardListeners.set(type, bucket);
      }
    ),
    removeEventListener: vi.fn(
      (
        type: string,
        listener: (event: {
          key: string;
          type?: string;
          target?: { tagName?: string };
          preventDefault?: () => void;
          stopPropagation?: () => void;
        }) => void
      ) => {
        keyboardListeners.get(type)?.delete(listener);
      }
    )
  };

  keyboardListeners.clear();
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument
  });

  try {
    run();
  } finally {
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
    keyboardListeners.clear();
  }
}

function findAllByType(
  node: unknown,
  type: string
): Array<{ readonly type: string; readonly props: Record<string, unknown> }> {
  if (!node || typeof node !== "object") {
    return [];
  }

  const element = node as {
    readonly type?: string | ((props: unknown) => unknown);
    readonly props?: { readonly children?: unknown };
  };

  if (typeof element.type === "function") {
    return findAllByType(element.type(element.props ?? {}), type);
  }

  const children = element.props?.children;
  const childNodes = Array.isArray(children) ? children : [children];
  const nested = childNodes.flatMap((child) => findAllByType(child, type));

  return element.type === type ? [element as never, ...nested] : nested;
}

describe("SettingsOverlay", () => {
  it("renders nothing while closed", () => {
    withFakeDocument(() => {
      expect(
        SettingsOverlay({
          open: false,
          preferences: DEFAULT_AUDIO_PREFERENCES,
          onChange: vi.fn(),
          onClose: vi.fn()
        })
      ).toBeNull();
      expect(keyboardListeners.size).toBe(0);
    });
  });

  it("renders an accessible modal with audio sliders and a close button while open", () => {
    withFakeDocument(() => {
      const tree = SettingsOverlay({
        open: true,
        preferences: DEFAULT_AUDIO_PREFERENCES,
        onChange: vi.fn(),
        onClose: vi.fn()
      });
      const buttons = findAllByType(tree, "button");
      const inputs = findAllByType(tree, "input");
      const dialog = findAllByType(tree, "section").find(
        (element) => element.props.role === "dialog"
      );

      expect(dialog?.props["aria-label"]).toBe("Settings");
      expect(inputs).toHaveLength(3);
      expect(inputs.map((input) => input.props["aria-label"])).toEqual([
        "Announcer",
        "Gameplay",
        "Music"
      ]);
      expect(buttons.some((button) => button.props.children === "Close")).toBe(true);
    });
  });

  it("calls onClose from the close button and Escape key", () => {
    withFakeDocument(() => {
      const onClose = vi.fn();
      const tree = SettingsOverlay({
        open: true,
        preferences: DEFAULT_AUDIO_PREFERENCES,
        onChange: vi.fn(),
        onClose
      });
      const closeButton = findAllByType(tree, "button").find(
        (element) => element.props.children === "Close"
      );

      if (!closeButton) {
        throw new Error("Expected close button");
      }

      (closeButton.props.onClick as () => void)();
      keyboardListeners
        .get("keydown")
        ?.forEach((listener) =>
          listener({
            key: "Escape",
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          })
        );

      expect(onClose).toHaveBeenCalledTimes(2);
    });
  });

  it("treats fixture escape without type or DOM methods as a keydown close", () => {
    withFakeDocument(() => {
      const onClose = vi.fn();
      SettingsOverlay({
        open: true,
        preferences: DEFAULT_AUDIO_PREFERENCES,
        onChange: vi.fn(),
        onClose
      });

      keyboardListeners.get("keydown")?.forEach((listener) =>
        listener({
          key: "Escape"
        })
      );

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("swallows gameplay keys so overlay sliders do not steer live play", () => {
    withFakeDocument(() => {
      SettingsOverlay({
        open: true,
        preferences: DEFAULT_AUDIO_PREFERENCES,
        onChange: vi.fn(),
        onClose: vi.fn()
      });
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();

      keyboardListeners.get("keydown")?.forEach((listener) =>
        listener({
          key: "w",
          target: { tagName: "INPUT" },
          preventDefault,
          stopPropagation
        })
      );

      expect(stopPropagation).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(1);
    });
  });

  it("preserves slider arrow defaults while still blocking propagation", () => {
    withFakeDocument(() => {
      SettingsOverlay({
        open: true,
        preferences: DEFAULT_AUDIO_PREFERENCES,
        onChange: vi.fn(),
        onClose: vi.fn()
      });
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();

      keyboardListeners.get("keydown")?.forEach((listener) =>
        listener({
          key: "ArrowRight",
          target: { tagName: "INPUT" },
          preventDefault,
          stopPropagation
        })
      );

      expect(stopPropagation).toHaveBeenCalledTimes(1);
      expect(preventDefault).not.toHaveBeenCalled();
    });
  });
});
