import type { ArcadeClientState } from "../store.js";
import { Callouts } from "./Callouts.js";
import { ScoreHud } from "./ScoreHud.js";
import { TargetIndicator } from "./TargetIndicator.js";
import { TurboMeter } from "./TurboMeter.js";

export interface HUDProps {
  readonly state: ArcadeClientState;
}

// Grounded-arcade scope: powerup and special meters are cut from the match
// HUD (their systems are flag-disabled in the sim).
export function HUD({ state }: HUDProps): JSX.Element {
  const localSlotId =
    state.roster.find((slot) => slot.isOwnedByLocalPlayer)?.slotId ?? null;
  const localSkater =
    state.currentWorld?.skaters.find((skater) => skater.id === localSlotId) ??
    null;

  return (
    <div className="arcade-hud">
      <ScoreHud state={state} />
      {localSkater ? (
        <>
          <TurboMeter value={localSkater.turboMeter} />
          <TargetIndicator targetSlotId={localSkater.selectedTargetSlotId} />
        </>
      ) : null}
      <Callouts events={state.currentWorld?.eventQueue ?? []} />
    </div>
  );
}
