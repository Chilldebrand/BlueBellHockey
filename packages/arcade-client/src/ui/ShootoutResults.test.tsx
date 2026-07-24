import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ShootoutResults } from "./ShootoutResults.js";

describe("ShootoutResults", () => {
  it("shows the final tally, per-shot boxes, and both actions", () => {
    const html = renderToStaticMarkup(
      <ShootoutResults
        results={["goal", "miss", "goal", "miss", "miss"]}
        onRetry={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(html).toContain("SHOOTOUT COMPLETE");
    expect(html).toContain("2 / 5");
    expect(html.match(/is-goal/g)).toHaveLength(2);
    expect(html.match(/is-miss/g)).toHaveLength(3);
    expect(html).toContain("Retry");
    expect(html).toContain("Exit To Menu");
  });
});
