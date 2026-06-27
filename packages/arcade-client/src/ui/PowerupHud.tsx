export function PowerupHud({
  heldPowerupType
}: {
  readonly heldPowerupType: string | null;
}): JSX.Element {
  return (
    <div className="powerup-hud" aria-label="Held powerup">
      <span>Powerup</span>
      <strong>{heldPowerupType ?? "None"}</strong>
    </div>
  );
}
