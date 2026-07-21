import { useEffect, useState } from "react";

/**
 * Shared mutable counters for the perf overlay. Hot paths increment these
 * (cheap field writes); the HUD samples and resets them once per second.
 */
export const perfCounters = {
  worldSnapshots: 0,
  roomStatePatches: 0,
  appRenders: 0
};

interface PerfSample {
  readonly fps: number;
  readonly longTaskMsPerS: number;
  readonly worldSnapshotsPerS: number;
  readonly roomStatePatchesPerS: number;
  readonly appRendersPerS: number;
  readonly heapMb: number | null;
}

const EMPTY_SAMPLE: PerfSample = {
  fps: 0,
  longTaskMsPerS: 0,
  worldSnapshotsPerS: 0,
  roomStatePatchesPerS: 0,
  appRendersPerS: 0,
  heapMb: null
};

/**
 * Diagnostic overlay (dev tool, like the Feel Lab): frame rate, main-thread
 * long-task saturation, network dispatch rates, and JS heap, sampled over
 * 1s windows. Mounted in both Free Skate and online play so the two can be
 * compared with the same instrument. Dev builds only — production players
 * must never see it.
 */
export function PerfHud(): JSX.Element | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  return <PerfHudImpl />;
}

function PerfHudImpl(): JSX.Element {
  const [sample, setSample] = useState<PerfSample>(EMPTY_SAMPLE);

  useEffect(() => {
    let disposed = false;
    let frames = 0;
    let longTaskMs = 0;
    let raf = 0;

    const countFrame = () => {
      frames += 1;
      raf = requestAnimationFrame(countFrame);
    };
    raf = requestAnimationFrame(countFrame);

    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskMs += entry.duration;
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // Long-task timing unsupported (jsdom, older browsers) — leave at 0.
    }

    const intervalId = window.setInterval(() => {
      if (disposed) {
        return;
      }

      const memory = (
        performance as unknown as {
          memory?: { usedJSHeapSize: number };
        }
      ).memory;

      setSample({
        fps: frames,
        longTaskMsPerS: Math.round(longTaskMs),
        worldSnapshotsPerS: perfCounters.worldSnapshots,
        roomStatePatchesPerS: perfCounters.roomStatePatches,
        appRendersPerS: perfCounters.appRenders,
        heapMb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null
      });
      frames = 0;
      longTaskMs = 0;
      perfCounters.worldSnapshots = 0;
      perfCounters.roomStatePatches = 0;
      perfCounters.appRenders = 0;
    }, 1000);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 1000,
        padding: "6px 10px",
        background: "rgba(10, 14, 24, 0.78)",
        color: "#9fe3ff",
        font: "12px/1.5 Consolas, monospace",
        borderRadius: 6,
        pointerEvents: "none",
        whiteSpace: "pre"
      }}
      aria-label="Performance overlay"
    >
      {[
        `fps        ${sample.fps}`,
        `jank ms/s  ${sample.longTaskMsPerS}`,
        `snaps/s    ${sample.worldSnapshotsPerS}`,
        `patches/s  ${sample.roomStatePatchesPerS}`,
        `renders/s  ${sample.appRendersPerS}`,
        sample.heapMb !== null ? `heap MB    ${sample.heapMb}` : null
      ]
        .filter(Boolean)
        .join("\n")}
    </div>
  );
}
