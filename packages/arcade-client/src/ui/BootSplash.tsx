export function BootSplash({
  onContinue
}: {
  readonly onContinue: () => void;
}): JSX.Element {
  return (
    <main className="menu-screen boot-screen">
      <h1>BBH Arcade</h1>
      <p>Original 3v3 arcade hockey</p>
      <button type="button" onClick={onContinue}>
        Press Start
      </button>
    </main>
  );
}
