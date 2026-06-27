import type { ArcadeClientState } from "../store.js";
import { Callouts } from "./Callouts.js";
import { PowerupHud } from "./PowerupHud.js";
import { ScoreHud } from "./ScoreHud.js";
import { SpecialMeter } from "./SpecialMeter.js";
import { TargetIndicator } from "./TargetIndicator.js";
import { TurboMeter } from "./TurboMeter.js";

export interface HUDProps {
  readonly state: ArcadeClientState;
}

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
          <PowerupHud heldPowerupType={localSkater.heldPowerupType} />
          <SpecialMeter charge={localSkater.specialCharge} />
        </>
      ) : null}
      <Callouts events={state.currentWorld?.eventQueue ?? []} />
    </div>
  );
}
