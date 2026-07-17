import { describe, expect, it, vi } from "vitest";
import {
  isMenuMusicAllowed,
  shouldReconnectAfterAudioInit
} from "./runtimeGuards.js";

describe("runtimeGuards", () => {
  it("allows menu music only in menu, non-playing lobby, and postgame", () => {
    expect(isMenuMusicAllowed("menu", "waiting")).toBe(true);
    expect(isMenuMusicAllowed("lobby", "waiting")).toBe(true);
    expect(isMenuMusicAllowed("lobby", "ended")).toBe(true);

    expect(isMenuMusicAllowed("boot", "waiting")).toBe(false);
    expect(isMenuMusicAllowed("lobby", "playing")).toBe(false);
    expect(isMenuMusicAllowed("freeskate", "playing")).toBe(false);
    expect(isMenuMusicAllowed("menu", "playing")).toBe(true);
  });

  it("blocks auto reconnect until audio has been initialized by Press Start", () => {
    expect(
      shouldReconnectAfterAudioInit({
        audioReady: false,
        hasReconnectTicket: true,
        reconnectPreviousRoom: vi.fn()
      })
    ).toBe(false);

    expect(
      shouldReconnectAfterAudioInit({
        audioReady: true,
        hasReconnectTicket: true,
        reconnectPreviousRoom: vi.fn()
      })
    ).toBe(true);
  });
});
