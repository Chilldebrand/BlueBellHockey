import type { ArcadeClientState } from "../store.js";
import { AnnouncementBanner } from "./AnnouncementBanner.js";
import { Callouts } from "./Callouts.js";
import { FinalCountdown } from "./FinalCountdown.js";
import { ScoreHud } from "./ScoreHud.js";
import { TurboMeter } from "./TurboMeter.js";

export interface HUDProps {
  readonly state: ArcadeClientState;
  readonly onOpenSettings?: () => void;
}

export function HUD({ state, onOpenSettings }: HUDProps): JSX.Element {
  const localSlotId =
    state.roster.find((slot) => slot.isOwnedByLocalPlayer)?.slotId ?? null;
  const localSkater =
    state.currentWorld?.skaters.find((skater) => skater.id === localSlotId) ??
    null;

  return (
    <div className="arcade-hud">
      <ScoreHud state={state} />
      {localSkater ? (
        <TurboMeter value={localSkater.turboMeter} />
      ) : null}
      <Callouts events={state.currentWorld?.eventQueue ?? []} />
      <AnnouncementBanner
        events={state.currentWorld?.eventQueue ?? []}
        nowMs={state.currentWorld?.time.nowMs ?? 0}
      />
      <FinalCountdown world={state.currentWorld} />
      {onOpenSettings ? (
        <button
          type="button"
          className="hud-settings-button"
          onClick={onOpenSettings}
        >
          Settings
        </button>
      ) : null}
    </div>
  );
}
