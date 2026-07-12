import type { ArcadeClientState } from "../store.js";
import { Callouts } from "./Callouts.js";
import { ScoreHud } from "./ScoreHud.js";
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
        <TurboMeter value={localSkater.turboMeter} />
      ) : null}
      <Callouts events={state.currentWorld?.eventQueue ?? []} />
    </div>
  );
}
