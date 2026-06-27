import type { TeamId } from "@bbh/arcade-core";
import { TEAM_PALETTES } from "@bbh/arcade-core";

export interface TeamSelectProps {
  readonly disabled: boolean;
  readonly onChooseTeam: (teamId: TeamId) => void;
}

export function TeamSelect({
  disabled,
  onChooseTeam
}: TeamSelectProps): JSX.Element {
  return (
    <div className="team-actions" aria-label="Team select">
      {(["home", "away"] as const).map((teamId) => (
        <button
          key={teamId}
          type="button"
          onClick={() => onChooseTeam(teamId)}
          disabled={disabled}
        >
          <span
            className="team-swatch"
            style={{ background: TEAM_PALETTES[teamId].iconColor }}
          />
          {TEAM_PALETTES[teamId].displayName}
        </button>
      ))}
    </div>
  );
}
