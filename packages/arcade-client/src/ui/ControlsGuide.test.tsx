import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ControlsGuide } from "./ControlsGuide.js";

describe("ControlsGuide", () => {
  it("shows the gamepad diagram with a callout per bound control", () => {
    const html = renderToStaticMarkup(<ControlsGuide />);

    expect(html).toContain("Gamepad control diagram");
    expect(html).toContain("Left stick · Skate");
    expect(html).toContain("Right stick · Skill stick");
    expect(html).toContain("RT · Pass (hold to charge)");
    expect(html).toContain("RB · Poke check");
    expect(html).toContain("LB · Dive / block shot");
    expect(html).toContain("B · Shoulder check");
    expect(html).toContain("X · Hip check");
    expect(html).toContain("Click (L3) · Turbo");
  });

  it("lists every keyboard and mouse binding", () => {
    const html = renderToStaticMarkup(<ControlsGuide />);

    for (const key of ["W", "A", "S", "D", "Shift", "Mouse", "Space", "F", "G", "R", "V"]) {
      expect(html).toContain(`<kbd>${key}</kbd>`);
    }
    expect(html).toContain("Body check");
    expect(html).toContain("Poke check");
    expect(html).toContain("Simple shot");
  });
});
