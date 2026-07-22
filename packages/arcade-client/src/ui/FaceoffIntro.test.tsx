import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FaceoffIntro } from "./FaceoffIntro.js";

describe("FaceoffIntro", () => {
  it("shows the countdown digits only while the faceoff hold is active", () => {
    const heldHtml = renderToStaticMarkup(
      <FaceoffIntro phase="playing" faceoffUntilMs={5000} nowMs={2100} />
    );
    expect(heldHtml).toContain("role=\"timer\"");
    expect(heldHtml).toContain(">3<");

    const finalSecond = renderToStaticMarkup(
      <FaceoffIntro phase="playing" faceoffUntilMs={5000} nowMs={4900} />
    );
    expect(finalSecond).toContain(">1<");
  });

  it("renders nothing once play is live (the old always-on overlay bug)", () => {
    expect(
      renderToStaticMarkup(
        <FaceoffIntro phase="playing" faceoffUntilMs={5000} nowMs={5000} />
      )
    ).toBe("");
    expect(
      renderToStaticMarkup(
        <FaceoffIntro phase="playing" faceoffUntilMs={0} nowMs={60_000} />
      )
    ).toBe("");
    expect(
      renderToStaticMarkup(
        <FaceoffIntro phase="waiting" faceoffUntilMs={5000} nowMs={0} />
      )
    ).toBe("");
  });
});
