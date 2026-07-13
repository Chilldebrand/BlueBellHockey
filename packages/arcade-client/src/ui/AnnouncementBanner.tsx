import {
  POWERUP_DEFINITIONS,
  type PowerupType,
  type WorldEvent
} from "@bbh/arcade-core";

/** How long each banner stays up, measured on the SIM clock (deterministic —
 * works identically online, in Free Skate, and in replays). */
export const GOAL_BANNER_MS = 2500;
export const POWERUP_BANNER_MS = 2000;

export interface AnnouncementBannerProps {
  readonly events: readonly WorldEvent[];
  /** Current sim time (world.time.nowMs). */
  readonly nowMs: number;
}

export interface Announcement {
  readonly kind: "goal" | "powerup";
  readonly text: string;
}

/**
 * The announcement to show right now, or null. Goals outrank powerups; within
 * a kind the newest event wins. Pure so tests can drive it directly.
 */
export function selectAnnouncement(
  events: readonly WorldEvent[],
  nowMs: number
): Announcement | null {
  const goal = newestWithin(events, "goal", nowMs, GOAL_BANNER_MS);
  if (goal) {
    return { kind: "goal", text: "GOAL!!!" };
  }

  const pickup = newestWithin(events, "powerupPickup", nowMs, POWERUP_BANNER_MS);
  if (pickup?.targetSlotId) {
    // powerupPickup smuggles the powerup type in targetSlotId.
    const label =
      POWERUP_DEFINITIONS[pickup.targetSlotId as PowerupType]?.label;
    if (label) {
      return { kind: "powerup", text: `${label}!` };
    }
  }

  return null;
}

function newestWithin(
  events: readonly WorldEvent[],
  type: string,
  nowMs: number,
  windowMs: number
): WorldEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === type) {
      return nowMs - event.atMs < windowMs ? event : null;
    }
  }
  return null;
}

/**
 * Center-screen announcements: GOAL!!! in large letters, powerup activations
 * ("Super Speed!", "Tiny Goalie!", ...) in medium ones. Plain DOM overlay in
 * the FaceoffIntro style; visibility is re-derived from the event queue every
 * render, so there's no timer state to clean up.
 */
export function AnnouncementBanner({
  events,
  nowMs
}: AnnouncementBannerProps): JSX.Element | null {
  const announcement = selectAnnouncement(events, nowMs);

  if (!announcement) {
    return null;
  }

  return (
    <div
      className={
        announcement.kind === "goal"
          ? "announcement-banner announcement-goal"
          : "announcement-banner announcement-powerup"
      }
      role="status"
      aria-live="assertive"
    >
      {announcement.text}
    </div>
  );
}
