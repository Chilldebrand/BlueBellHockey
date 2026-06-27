export function SpecialMeter({
  charge
}: {
  readonly charge: number;
}): JSX.Element {
  return (
    <div className="special-meter" aria-label="Special meter">
      <span>Special</span>
      <meter min={0} max={1} value={Math.max(0, Math.min(1, charge))} />
    </div>
  );
}
