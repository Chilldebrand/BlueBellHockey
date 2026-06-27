import { describe, expect, it } from "vitest";
import { ArcadeRoom } from "./rooms/ArcadeRoom.js";
import { getArcadeServerInfo, registerArcadeRooms } from "./index";

describe("arcade server", () => {
  it("exports package metadata with core version", () => {
    expect(getArcadeServerInfo()).toEqual({
      name: "@bbh/arcade-server",
      coreVersion: "0.1.0"
    });
  });

  it("registers arcade rooms without default options overwriting auth-normalized filters", () => {
    const calls: unknown[][] = [];
    const filters: string[][] = [];
    const fakeServer = {
      define: (...args: unknown[]) => {
        calls.push(args);
        return {
          filterBy: (fields: string[]) => {
            filters.push(fields);
            return fakeServer;
          }
        };
      }
    };

    registerArcadeRooms(fakeServer as never);

    expect(calls).toEqual([["arcade", ArcadeRoom]]);
    expect(filters).toEqual([["privateCode", "mode"]]);
  });
});
