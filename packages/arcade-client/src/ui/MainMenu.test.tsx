import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BootSplash } from "./BootSplash.js";
import { MainMenu } from "./MainMenu.js";

describe("arcade menu flow", () => {
  it("renders boot splash and main menu actions", () => {
    const splash = renderToStaticMarkup(<BootSplash onContinue={vi.fn()} />);
    expect(splash).toContain("Press Start");
    expect(splash).toContain("Original 3v3 Arcade Hockey");
    const menu = renderToStaticMarkup(
      <MainMenu
        onQuickMatch={vi.fn()}
        onPrivateRoom={vi.fn()}
        onFreeSkate={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );
    expect(menu).toContain("Quick Match");
    expect(menu).toContain("Private Room");
    expect(menu).toContain("Free Skate");
    expect(menu).toContain("Settings");
    // Quick Match is the default keyboard/gamepad focus (yellow bar).
    expect(menu).toContain("is-focused");
  });
});
