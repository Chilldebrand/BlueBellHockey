import { describe, expect, it } from "vitest";
import { RINK_CONFIG } from "../config/rink.js";
import { containCircleInRink } from "./boards.js";

const RADIUS = 20;
const RESTITUTION = 0.6;
const TANGENT = 0.9;

describe("rounded-rect board containment", () => {
  it("returns null and leaves state alone away from the boards", () => {
    const position = { x: RINK_CONFIG.width / 2, y: RINK_CONFIG.height / 2 };
    const velocity = { x: 123, y: -45 };

    const contact = containCircleInRink(position, velocity, RADIUS, RESTITUTION, TANGENT);

    expect(contact).toBeNull();
    expect(position).toEqual({
      x: RINK_CONFIG.width / 2,
      y: RINK_CONFIG.height / 2
    });
    expect(velocity).toEqual({ x: 123, y: -45 });
  });

  it("reflects off a straight wall with restitution and tangential retention", () => {
    const position = { x: RINK_CONFIG.width / 2, y: RINK_CONFIG.height + 5 };
    const velocity = { x: 200, y: 300 };

    const contact = containCircleInRink(position, velocity, RADIUS, RESTITUTION, TANGENT);

    expect(contact?.normal).toEqual({ x: 0, y: -1 });
    expect(position.y).toBe(RINK_CONFIG.height - RADIUS);
    expect(velocity.y).toBeCloseTo(-300 * RESTITUTION, 6);
    expect(velocity.x).toBeCloseTo(200 * TANGENT, 6);
  });

  it("contains the corner arc and pushes back along the corner normal", () => {
    // Aim straight into the top-left corner arc at 45°.
    const position = { x: 12, y: 12 };
    const velocity = { x: -100, y: -100 };

    const contact = containCircleInRink(position, velocity, RADIUS, RESTITUTION, TANGENT);

    expect(contact).not.toBeNull();

    const corner = RINK_CONFIG.cornerRadius;
    const distance = Math.hypot(position.x - corner, position.y - corner);
    expect(distance).toBeCloseTo(corner - RADIUS, 6);
    // Velocity reversed away from the corner (was heading outward at 45°).
    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.y).toBeGreaterThan(0);
  });

  it("lets a puck rim the corner: tangential speed survives the bounce", () => {
    const corner = RINK_CONFIG.cornerRadius;
    // On the top-left corner arc, at 45°, sliding tangentially.
    const arcRadius = corner - RADIUS;
    const position = {
      x: corner - arcRadius * Math.SQRT1_2 - 2,
      y: corner - arcRadius * Math.SQRT1_2 - 2
    };
    const tangent = { x: -Math.SQRT1_2, y: Math.SQRT1_2 }; // along the arc
    const velocity = { x: tangent.x * 400, y: tangent.y * 400 };

    containCircleInRink(position, velocity, RADIUS, RESTITUTION, TANGENT);

    const speed = Math.hypot(velocity.x, velocity.y);
    expect(speed).toBeGreaterThan(400 * TANGENT * 0.9);
  });

  it("does not treat mid-wall contact as a corner", () => {
    const position = { x: RINK_CONFIG.width / 2, y: -4 };
    const velocity = { x: 50, y: -100 };

    const contact = containCircleInRink(position, velocity, RADIUS, RESTITUTION, TANGENT);

    expect(contact?.normal).toEqual({ x: 0, y: 1 });
    expect(position.x).toBe(RINK_CONFIG.width / 2);
    expect(position.y).toBe(RADIUS);
  });
});
