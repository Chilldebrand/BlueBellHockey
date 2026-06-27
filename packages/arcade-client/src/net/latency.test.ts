import { describe, expect, it } from "vitest";
import { scheduleNetworkMessage } from "./latency.js";

describe("latency profile helpers", () => {
  it("schedules deterministic delivery inside the configured latency window", () => {
    const first = scheduleNetworkMessage("snapshot", 1000, 7, {
      baseMs: 80,
      jitterMs: 40,
      packetLossRate: 0
    });
    const second = scheduleNetworkMessage("snapshot", 1000, 7, {
      baseMs: 80,
      jitterMs: 40,
      packetLossRate: 0
    });

    expect(first).toEqual(second);
    expect(first.deliverAtMs).toBeGreaterThanOrEqual(1080);
    expect(first.deliverAtMs).toBeLessThanOrEqual(1120);
    expect(first.dropped).toBe(false);
  });

  it("can deterministically model packet loss for smoke tests", () => {
    const scheduled = Array.from({ length: 12 }, (_, index) =>
      scheduleNetworkMessage("input", 0, index, {
        baseMs: 60,
        jitterMs: 20,
        packetLossRate: 0.35
      })
    );

    expect(scheduled.some((message) => message.dropped)).toBe(true);
    expect(scheduled.some((message) => !message.dropped)).toBe(true);
  });
});
