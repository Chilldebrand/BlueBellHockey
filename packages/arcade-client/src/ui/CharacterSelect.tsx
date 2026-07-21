import {
  ARCADE_CHARACTERS,
  CHARACTER_SPECIALS,
  CHARACTER_STAT_KEYS,
  type CharacterId
} from "@bbh/arcade-core";

export interface CharacterSelectProps {
  /** The editing slot's current character (highlighted in the grid). */
  readonly selectedCharacterId: CharacterId | null;
  /** e.g. "Pick for Ada" / "Pick for Bot 2". */
  readonly headline: string;
  readonly disabled: boolean;
  readonly onChooseCharacter: (characterId: CharacterId) => void;
  readonly onClose: () => void;
}

const SPECIAL_BY_ID = new Map(
  CHARACTER_SPECIALS.map((special) => [special.id, special])
);

/**
 * Dumb character picker for whichever slot the lobby is editing. Stays open
 * after a pick (the server round-trips the roster and the highlight follows);
 * Done closes it.
 */
export function CharacterSelect({
  selectedCharacterId,
  headline,
  disabled,
  onChooseCharacter,
  onClose
}: CharacterSelectProps): JSX.Element {
  return (
    <section className="character-select" aria-label="Character select">
      <div className="character-picker-header">
        <h3>{headline}</h3>
        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>
      <div className="character-grid">
        {ARCADE_CHARACTERS.map((character) => {
          const special = SPECIAL_BY_ID.get(character.specialId);
          const selected = character.id === selectedCharacterId;

          return (
            <button
              key={character.id}
              type="button"
              className={selected ? "character-card selected" : "character-card"}
              onClick={() => onChooseCharacter(character.id)}
              disabled={disabled}
            >
              <div className="character-card-head">
                <strong>{character.displayName}</strong>
                <span className="character-card-number" aria-hidden="true">
                  {character.jerseyNumber}
                </span>
              </div>
              <span className="character-card-special">
                {special?.name ?? character.specialId}
              </span>
              <small>{character.silhouette}</small>
              <div className="stat-grid" aria-label={`${character.displayName} stats`}>
                {CHARACTER_STAT_KEYS.map((key) => (
                  <span key={key}>
                    {key}
                    <span
                      className="stat-bar"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-valuenow={character.stats[key]}
                      aria-label={key}
                    >
                      <span
                        className="stat-bar-fill"
                        style={{
                          width: `${(character.stats[key] / 5) * 100}%`
                        }}
                      />
                    </span>
                  </span>
                ))}
              </div>
              {selected ? <em>Selected</em> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
