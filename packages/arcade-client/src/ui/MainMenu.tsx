export interface MainMenuProps {
  readonly onQuickMatch: () => void;
  readonly onPrivateRoom: () => void;
  readonly onFreeSkate?: () => void;
  readonly onOpenSettings?: () => void;
}

export function MainMenu({
  onQuickMatch,
  onPrivateRoom,
  onFreeSkate,
  onOpenSettings
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
      {onOpenSettings ? (
        <button type="button" onClick={onOpenSettings}>
          Settings
        </button>
      ) : null}
    </main>
  );
}
