import {
  ARCADE_CHARACTERS,
  CHARACTER_SPECIALS,
  CHARACTER_STAT_KEYS,
  type CharacterId
} from "@bbh/arcade-core";
import type { ClientRosterSlot } from "../store.js";

export interface CharacterSelectProps {
  readonly roster: readonly ClientRosterSlot[];
  readonly localSessionId: string | null;
  readonly disabled: boolean;
  readonly onChooseCharacter: (characterId: CharacterId) => void;
}

const SPECIAL_BY_ID = new Map(
  CHARACTER_SPECIALS.map((special) => [special.id, special])
);

export function CharacterSelect({
  roster,
  localSessionId,
  disabled,
  onChooseCharacter
}: CharacterSelectProps): JSX.Element {
  const selectedCharacterId =
    roster.find((slot) => slot.sessionId === localSessionId)?.characterId ?? null;

  return (
    <section className="character-select" aria-label="Character select">
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
              <strong>{character.displayName}</strong>
              <span>{special?.name ?? character.specialId}</span>
              <small>{character.silhouette}</small>
              <div className="stat-grid" aria-label={`${character.displayName} stats`}>
                {CHARACTER_STAT_KEYS.map((key) => (
                  <span key={key}>
                    {key}
                    <meter min={0} max={5} value={character.stats[key]} />
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
