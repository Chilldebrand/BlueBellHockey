export interface MainMenuProps {
  readonly onQuickMatch: () => void;
  readonly onPrivateRoom: () => void;
}

export function MainMenu({
  onQuickMatch,
  onPrivateRoom
}: MainMenuProps): JSX.Element {
  return (
    <main className="menu-screen main-menu">
      <h1>BBH Arcade</h1>
      <button type="button" onClick={onQuickMatch}>
        Quick Match
      </button>
      <button type="button" onClick={onPrivateRoom}>
        Private Room
      </button>
    </main>
  );
}
