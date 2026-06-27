import type { ArcadeClientState } from "../store.js";
import { Callouts } from "./Callouts.js";
import { ScoreHud } from "./ScoreHud.js";

export interface HUDProps {
  readonly state: ArcadeClientState;
}

export function HUD({ state }: HUDProps): JSX.Element {
  return (
    <div className="arcade-hud">
      <ScoreHud state={state} />
      <Callouts events={state.currentWorld?.eventQueue ?? []} />
    </div>
  );
}
