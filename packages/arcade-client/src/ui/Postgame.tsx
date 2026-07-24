import type { CSSProperties } from "react";
import {
  getCharacterById,
  teamIdentityFor,
  type TeamId,
  type TeamIdentity,
  type TeamIdentityId,
  type WorldState
} from "@bbh/arcade-core";
import { selectThreeStars, type ThreeStar } from "./threeStars.js";

/** Total roster size the vote counts against, and the votes that auto-start. */
const REMATCH_VOTE_TOTAL = 6;
const REMATCH_VOTES_TO_START = 4;

interface PanelRow {
  readonly key: string;
  readonly num: string;
  readonly name: string;
  readonly shots: number;
  readonly hits: number;
  readonly saves: number;
  readonly powerups: number;
  readonly isGoalie: boolean;
}

export function Postgame({
  world,
  rematchVotes,
  localHasVoted,
  isHost,
  teamIdentities,
  onRematch,
  onForceRematch,
  onChangeTeams,
  onExit
}: {
  readonly world: WorldState;
  readonly rematchVotes: number;
  readonly localHasVoted: boolean;
  readonly isHost: boolean;
  /** Captain-chosen identities; omitted falls back to blue vs red. */
  readonly teamIdentities?: Readonly<Record<TeamId, TeamIdentityId>>;
  readonly onRematch: () => void;
  readonly onForceRematch: () => void;
  readonly onChangeTeams: () => void;
  readonly onExit: () => void;
}): JSX.Element {
  const stars = selectThreeStars(world);
  const first = stars.find((star) => star.rank === 1);
  const second = stars.find((star) => star.rank === 2);
  const third = stars.find((star) => star.rank === 3);
  const identities: Record<TeamId, TeamIdentity> = {
    home: teamIdentityFor("home", teamIdentities?.home),
    away: teamIdentityFor("away", teamIdentities?.away)
  };

  const winner = world.winnerTeamId;
  const winnerName = winner
    ? identities[winner].displayName.toUpperCase()
    : null;
  const voteLabel = `${rematchVotes}/${REMATCH_VOTE_TOTAL} VOTES · ${REMATCH_VOTES_TO_START} TO START`;

  return (
    <section className="pg-overlay" aria-label="Postgame">
      {/* Headline: winner + score */}
      <div className="pg-headline">
        <h1
          className={
            winner ? `pg-win pg-win--${winner}` : "pg-win pg-win--draw"
          }
          style={
            winner
              ? ({ "--team-color": identities[winner].iconColor } as CSSProperties)
              : undefined
          }
        >
          {winnerName ? `${winnerName} WIN` : "DRAW"}
        </h1>
        <div className="pg-score">
          <span
            className="pg-score-team pg-score-team--home"
            style={{ "--team-color": identities.home.iconColor } as CSSProperties}
          >
            {identities.home.shortName}
          </span>
          <span className="pg-score-value">{world.score.home}</span>
          <span className="pg-score-dash">&ndash;</span>
          <span className="pg-score-value">{world.score.away}</span>
          <span
            className="pg-score-team pg-score-team--away"
            style={{ "--team-color": identities.away.iconColor } as CSSProperties}
          >
            {identities.away.shortName}
          </span>
        </div>
      </div>

      {/* Three stars: second, first (center), third */}
      <div className="pg-stars">
        {second ? (
          <StarCard
            star={second}
            variant="side"
            delay="0.6s"
            teamColor={identities[second.teamId].iconColor}
          />
        ) : null}
        {first ? (
          <StarCard
            star={first}
            variant="first"
            delay="0.4s"
            teamColor={identities[first.teamId].iconColor}
          />
        ) : null}
        {third ? (
          <StarCard
            star={third}
            variant="side"
            delay="0.8s"
            teamColor={identities[third.teamId].iconColor}
          />
        ) : null}
      </div>

      {/* Per-team player stat panels */}
      <div className="pg-panels">
        <TeamPanel world={world} teamId="home" identity={identities.home} />
        <TeamPanel world={world} teamId="away" identity={identities.away} />
      </div>

      {/* Actions */}
      <div className="pg-actions">
        <button
          type="button"
          className={
            localHasVoted ? "pg-btn-rematch pg-btn-rematch--voted" : "pg-btn-rematch"
          }
          onClick={onRematch}
          disabled={localHasVoted}
        >
          <span className="pg-btn-rematch-line1">
            {localHasVoted ? "VOTED ✓" : "REMATCH ▸"}
          </span>
          <span className="pg-btn-rematch-line2">{voteLabel}</span>
        </button>
        {isHost ? (
          <button type="button" className="pg-btn-force" onClick={onForceRematch}>
            Force Rematch
          </button>
        ) : null}
        <button
          type="button"
          className="pg-btn-secondary pg-btn-change"
          onClick={onChangeTeams}
        >
          Change Teams
        </button>
        <button
          type="button"
          className="pg-btn-secondary pg-btn-exit"
          onClick={onExit}
        >
          Exit
        </button>
      </div>
    </section>
  );
}

const RANK_PREFIX = ["★", "★★", "★★★"];
const RANK_WORD = ["FIRST STAR", "SECOND STAR", "THIRD STAR"];

function StarCard({
  star,
  variant,
  delay,
  teamColor
}: {
  readonly star: ThreeStar;
  readonly variant: "first" | "side";
  readonly delay: string;
  readonly teamColor: string;
}): JSX.Element {
  const character = getCharacterById(star.characterId);
  const rankLabel = `${RANK_PREFIX[star.rank - 1] ?? "★"} ${
    RANK_WORD[star.rank - 1] ?? "STAR"
  }`;

  const body = (
    <>
      <div className="pg-star-head">
        <div>
          <div
            className={
              variant === "first"
                ? "pg-star-rank pg-star-rank--first"
                : "pg-star-rank pg-star-rank--muted"
            }
          >
            {rankLabel}
          </div>
          <div className="pg-star-name">{character.displayName}</div>
        </div>
        <div className={`pg-jersey pg-jersey--${star.teamId}`}>
          {character.jerseyNumber}
        </div>
      </div>
      <div className="pg-star-stats">
        <StatBox teamId={star.teamId} value={star.goals} label="GOALS" />
        <StatBox teamId={star.teamId} value={star.assists} label="ASSISTS" />
        <StatBox teamId={star.teamId} value={star.hits} label="HITS" />
      </div>
    </>
  );

  if (variant === "first") {
    return (
      <div
        className="pg-first"
        style={
          { animationDelay: delay, "--team-color": teamColor } as CSSProperties
        }
      >
        <div className="pg-medallion">{"★"}</div>
        <div className="pg-first-card">
          <div className="pg-first-accent" />
          <div className="pg-shine" />
          <div className="pg-first-body">{body}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`pg-star-card pg-star-card--${star.teamId}`}
      style={
        { animationDelay: delay, "--team-color": teamColor } as CSSProperties
      }
    >
      <div className={`pg-accent pg-accent--${star.teamId}`} />
      <div className="pg-star-body">{body}</div>
    </div>
  );
}

function StatBox({
  teamId,
  value,
  label
}: {
  readonly teamId: TeamId;
  readonly value: number;
  readonly label: string;
}): JSX.Element {
  return (
    <div className={`pg-stat-box pg-stat-box--${teamId}`}>
      <div className="pg-stat-value">{value}</div>
      <div className="pg-stat-label">{label}</div>
    </div>
  );
}

function TeamPanel({
  world,
  teamId,
  identity
}: {
  readonly world: WorldState;
  readonly teamId: TeamId;
  readonly identity: TeamIdentity;
}): JSX.Element {
  const rows = teamPanelRows(world, teamId);

  return (
    <div
      className={`pg-panel pg-panel--${teamId}`}
      style={{ "--team-color": identity.iconColor } as CSSProperties}
    >
      <div className="pg-panel-row pg-panel-head">
        <div className={`pg-panel-team pg-panel-team--${teamId}`}>
          {identity.displayName.toUpperCase()}
        </div>
        <div className="pg-col-label">SHOTS</div>
        <div className="pg-col-label">HITS</div>
        <div className="pg-col-label">SAVES</div>
        <div className="pg-col-label">PWR</div>
      </div>
      {rows.map((row) => (
        <div className="pg-panel-row pg-player-row" key={row.key}>
          <div className="pg-player-name">
            <span className={`pg-player-num pg-player-num--${teamId}`}>
              {row.num}
            </span>
            {row.name}
          </div>
          <div className="pg-stat-cell">{row.shots}</div>
          <div className="pg-stat-cell">{row.hits}</div>
          <div className="pg-stat-cell">{row.saves}</div>
          <div className="pg-stat-cell pg-stat-cell--pwr">{row.powerups}</div>
        </div>
      ))}
    </div>
  );
}

function teamPanelRows(world: WorldState, teamId: TeamId): readonly PanelRow[] {
  const rows: PanelRow[] = world.skaters
    .filter((skater) => skater.teamId === teamId)
    .map((skater) => {
      const line = world.stats.players[skater.id];
      const character = getCharacterById(skater.characterId);
      return {
        key: skater.id,
        num: String(character.jerseyNumber),
        name: character.displayName,
        shots: line?.shots ?? 0,
        hits: line?.hits ?? 0,
        saves: line?.saves ?? 0,
        powerups: line?.powerups ?? 0,
        isGoalie: false
      };
    });

  const goalie = world.goalies.find((entity) => entity.teamId === teamId);
  if (goalie) {
    const line = world.stats.players[goalie.id];
    rows.push({
      key: goalie.id,
      num: "G",
      name: "Goalie",
      shots: 0,
      hits: 0,
      saves: line?.saves ?? 0,
      powerups: 0,
      isGoalie: true
    });
  }

  return rows;
}
