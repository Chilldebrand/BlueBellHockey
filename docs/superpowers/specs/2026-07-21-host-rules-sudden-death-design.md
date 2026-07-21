# Host Rules and Unlimited Sudden-Death Overtime

## Goal

Give the room creator pre-game control over a quick match's total time limit
and goal limit. A tied regulation clock must transition to unlimited
sudden-death overtime, where the next goal wins and no draw is possible.

## Scope

This feature applies to private-room pre-game setup and to the matches created
from that room. It does not add periods, in-game rule editing, or new game
modes.

## Match Rules

Each room has one replicated rules object with these values:

- `timeLimitMs`: one continuous regulation clock; allowed values are 3, 5, 7,
  or 10 minutes.
- `goalLimit`: `0` means no goal cap; allowed capped values are 3, 5, 7, or
  10 goals.

The default is a three-minute match with no goal cap, preserving the existing
quick-match feel.

Regulation ends when either condition happens first:

1. A team reaches the selected non-zero goal limit, or
2. The regulation clock reaches zero.

When regulation expires tied, the match enters unlimited sudden-death
overtime. Overtime has no running or expiring clock. The next goal immediately
ends the match; a draw cannot result from a tied regulation clock.

When regulation expires with a leader, that team wins normally. When a goal
reaches the goal limit, that team wins immediately, including before the
regulation clock expires.

## Authority and Lifecycle

The server owns the rules and replicates them in room state. A client may send
a rule-update request only when all of these conditions are true:

- the world is in the pre-game `waiting` phase;
- the sender is the current `roomCreatorSessionId`;
- both requested values are members of the allowed sets.

All other requests leave state unchanged and return the existing server-error
pattern where appropriate. The server copies the active rules into every fresh
world it creates: the initial start, a rematch, and a postgame return to the
pre-game room. Rules remain selected across rematches.

Changing rules never alters any human player's ready state. Rules cannot be
changed during countdown, live play, overtime, or postgame.

## Pre-game UI

The lobby displays a `Rules` button to every participant. It opens a compact
rules panel showing the current time and goal-limit selections.

The room creator can change both selections with preset controls. Every other
participant sees the exact same values, but the controls are disabled and the
panel states that the host controls rules. This is intentionally a `Rules`
button, not a settings button.

The panel is available only while the room is in the pre-game waiting state.

## Game Display

During regulation, the scoreboard shows the selected single-match countdown.
During sudden-death overtime, it shows `OT` and `NEXT GOAL` instead of a
running clock. The ordinary postgame result follows the winning overtime goal.

## Implementation Boundaries

- Keep rule validation and permissions in `ArcadeRoom`; the client is display
  and request-only.
- Keep match-ending and no-expiry overtime behavior in the deterministic core
  simulation.
- Use the existing replicated room schema and client store hydration pattern;
  do not create a client-only rule source.
- Preserve existing roster, readiness, creator-transfer, and rematch behavior
  except where a new world must receive the stored rules.

## Acceptance Tests

1. A host can select each allowed time and goal-limit preset while waiting;
   all clients receive the same values.
2. A non-host, invalid payload, or non-waiting update cannot alter rules.
3. Changing rules leaves all ready states untouched.
4. A match ends instantly when a team reaches the selected non-zero goal cap.
5. An untied regulation clock ends the match normally.
6. A tied regulation clock starts overtime, shows no expiring clock, and only
   ends after the next goal.
7. The selected rules carry into a rematch and remain visible to every player.
8. The lobby exposes `Rules` to everyone while only the host can edit controls.
