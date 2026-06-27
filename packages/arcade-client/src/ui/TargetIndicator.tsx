export interface TargetIndicatorProps {
  readonly targetSlotId: string | null;
}

export function TargetIndicator({
  targetSlotId
}: TargetIndicatorProps): JSX.Element {
  return (
    <div className="target-indicator" aria-label="Assist target">
      <span>Target</span>
      <strong>{targetSlotId ?? "Auto"}</strong>
    </div>
  );
}
