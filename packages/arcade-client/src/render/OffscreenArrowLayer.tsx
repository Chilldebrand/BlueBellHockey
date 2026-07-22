import { TEAM_PALETTES, type TeamId } from "@bbh/arcade-core";
import { registerArrowElement } from "./offscreenArrows.js";

export interface OffscreenArrowLayerProps {
  readonly skaters: readonly { readonly id: string; readonly teamId: TeamId }[];
  /** Human identity colors by entity id (AI skaters fall back to team color). */
  readonly highlightColorByEntityId: Readonly<Record<string, string>>;
}

/**
 * DOM sibling of the Canvas: one chevron per skater, hidden until the
 * in-canvas tracker positions it at the screen edge. Slot ids are stable for
 * a whole match, so this renders once and is driven imperatively after that.
 */
export function OffscreenArrowLayer({
  skaters,
  highlightColorByEntityId
}: OffscreenArrowLayerProps): JSX.Element {
  return (
    <div className="offscreen-arrow-layer" aria-hidden="true">
      {skaters.map((skater) => (
        <div
          key={skater.id}
          className="offscreen-arrow"
          ref={(element) => registerArrowElement(skater.id, element)}
          style={{
            color:
              highlightColorByEntityId[skater.id] ??
              TEAM_PALETTES[skater.teamId].iconColor
          }}
        >
          <svg viewBox="0 0 24 24" width="26" height="26">
            <path d="M4 4 L20 12 L4 20 Z" fill="currentColor" />
          </svg>
        </div>
      ))}
    </div>
  );
}
