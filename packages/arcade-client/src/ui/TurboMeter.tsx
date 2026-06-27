export interface TurboMeterProps {
  readonly value: number;
}

export function TurboMeter({ value }: TurboMeterProps): JSX.Element {
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <div className="turbo-meter" aria-label="Turbo meter">
      <span>Turbo</span>
      <meter min={0} max={1} value={clamped} />
    </div>
  );
}
