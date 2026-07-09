import { POWERUP_DEFINITIONS, type PowerupType } from "@bbh/arcade-core";

function labelFor(type: string | null): string {
  if (type && type in POWERUP_DEFINITIONS) {
    return POWERUP_DEFINITIONS[type as PowerupType].label;
  }
  return "None";
}

export function PowerupHud({
  heldPowerupType
}: {
  readonly heldPowerupType: string | null;
}): JSX.Element {
  return (
    <div className="powerup-hud" aria-label="Held powerup">
      <span>Powerup</span>
      <strong>{labelFor(heldPowerupType)}</strong>
    </div>
  );
}
