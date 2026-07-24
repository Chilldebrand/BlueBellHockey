import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShootoutHud } from "./ShootoutHud.js";

describe("ShootoutHud", () => {
  it("renders five boxes with ✓/✗ per result and highlights the live shot", () => {
    const html = renderToStaticMarkup(
      <ShootoutHud
        results={["goal", "miss"]}
        attemptIndex={2}
        phase="approach"
      />
    );

    expect(html).toContain("SHOT 3/5");
    expect(html.match(/shootout-box/g)?.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("is-goal");
    expect(html).toContain("is-miss");
    expect(html).toContain("is-current");
    expect(html).toContain("✓");
    expect(html).toContain("✗");
  });

  it("shows FINAL with no live highlight once complete", () => {
    const html = renderToStaticMarkup(
      <ShootoutHud
        results={["goal", "miss", "miss", "goal", "goal"]}
        attemptIndex={5}
        phase="complete"
      />
    );

    expect(html).toContain("FINAL");
    expect(html).not.toContain("is-current");
  });
});
