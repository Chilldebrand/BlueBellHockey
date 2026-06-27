export function FaceoffIntro({
  phase
}: {
  readonly phase: string;
}): JSX.Element | null {
  if (phase !== "playing") {
    return null;
  }

  return (
    <div className="faceoff-intro" aria-label="Faceoff intro">
      Faceoff
    </div>
  );
}
