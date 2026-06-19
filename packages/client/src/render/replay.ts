import type { Snapshot } from '../net/client.js';
import { sampleAtServer, type FrameRender } from '../game/interpolation.js';
import { useUi } from '../store.js';

// Slow-mo instant replay (WO-10). On a goal we freeze a slice of the snapshot ring
// buffer and play it back on our own slowed clock with a tight goal cam, then hand
// rendering back to the live stream. The captured Snapshot objects are immutable
// (each server patch pushes a fresh one), so they stay valid even as the live
// buffer rolls forward underneath us.

const CAPTURE_MS = 1500; // how much lead-up to the goal we replay
const SPEED = 0.5; // playback rate (0.5 = half speed)
const HOLD_MS = 250; // freeze on the final frame for a beat before cutting back
// Total wall-clock length ≈ CAPTURE_MS / SPEED + HOLD_MS ≈ 3.25s, sized to sit
// inside the (lengthened) goal-celebration pause so live play doesn't resume under it.

class GoalReplay {
  active = false;
  scoringTeam = 0;
  private frames: Snapshot[] = [];
  private startServerT = 0;
  private spanMs = 0;
  private startWall = 0;

  /** Capture the last CAPTURE_MS of action and begin slow-mo playback. */
  trigger(buffer: Snapshot[], scoringTeam: number): void {
    if (buffer.length < 2) return;
    const endT = buffer[buffer.length - 1].serverTime;
    const frames = buffer.filter((s) => s.serverTime >= endT - CAPTURE_MS);
    if (frames.length < 2) return;
    this.frames = frames.slice();
    this.startServerT = frames[0].serverTime;
    this.spanMs = endT - this.startServerT;
    this.startWall = performance.now();
    this.scoringTeam = scoringTeam;
    if (!this.active) {
      this.active = true;
      useUi.getState().set({ replayActive: true });
    }
  }

  /** The replay frame to render this tick, or null when not replaying. */
  sample(): FrameRender | null {
    if (!this.active) return null;
    const elapsed = (performance.now() - this.startWall) * SPEED;
    if (elapsed >= this.spanMs + HOLD_MS * SPEED) {
      this.stop();
      return null;
    }
    const t = this.startServerT + Math.min(elapsed, this.spanMs);
    return sampleAtServer(this.frames, t);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.frames = [];
    useUi.getState().set({ replayActive: false });
  }
}

export const goalReplay = new GoalReplay();
