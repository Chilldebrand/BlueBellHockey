import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BootSplash } from "./BootSplash.js";
import { MainMenu } from "./MainMenu.js";

describe("arcade menu flow", () => {
  it("renders boot splash and main menu actions", () => {
    expect(
      renderToStaticMarkup(<BootSplash onContinue={vi.fn()} />)
    ).toContain("Press Start");
    const menu = renderToStaticMarkup(
      <MainMenu onQuickMatch={vi.fn()} onPrivateRoom={vi.fn()} />
    );
    expect(menu).toContain("Quick Match");
    expect(menu).toContain("Private Room");
  });
});
