export interface MainMenuProps {
  readonly onQuickMatch: () => void;
  readonly onPrivateRoom: () => void;
  readonly onFreeSkate?: () => void;
}

export function MainMenu({
  onQuickMatch,
  onPrivateRoom,
  onFreeSkate
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
      {onFreeSkate ? (
        <button type="button" onClick={onFreeSkate}>
          Free Skate
        </button>
      ) : null}
    </main>
  );
}
