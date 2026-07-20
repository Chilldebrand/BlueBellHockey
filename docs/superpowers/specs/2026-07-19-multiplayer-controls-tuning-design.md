# Multiplayer Lobby, Controls, and Gameplay Tuning

## Goal

Make multiplayer matches easier to start and easier to read, while making passing and loose-puck collection feel more responsive. Preserve server authority for all shared-match decisions.

## Scope

1. Strengthen assisted, lead passing without removing defender interceptions.
2. Make loose pucks easier to collect while preserving intentional post-hit, poke, and block windows.
3. Reduce the power-up spawn rate by exactly 20 percent.
4. Add player names and a ready-gated lobby start flow.
5. Make human identity-ring colors consistent on every client.
6. Flip vertical stick controls automatically for the red/away team, with an Always Up override.

## Gameplay

### Assisted passing

Pass aim selects the best same-team skater within 65 degrees of the aimed direction (assist cosine `0.42`). The pass continues to target the recipient's predicted skating path. Base pass speed changes from `1512` to `1815`, full-charge bonus from `638` to `766`, reception radius from `72` to `90`, and reception speed tolerance from `2400` to `2850`. Opponents retain the existing interception, block, and loose-puck behavior.

### Loose-puck collection

Normal automatic loose-puck collection reach increases from `60` to `75`. This applies to ordinary skating pickups only. Existing pickup cooldowns after a shot, pass, hit, poke, block, or goalie rebound remain in force, so contact and defensive actions still create readable loose-puck moments.

### Power-up cadence

The shared power-up spawn interval changes from 9,000 ms to 11,250 ms. That produces exactly 20 percent fewer spawn opportunities over time. The existing deterministic spawn-point rotation and banana-peel substitution remain unchanged.

## Lobby and shared player state

### Names and readiness

The lobby provides each local human with a player-name input, initially filled from a browser-persisted preference. The client sends that name while joining and can update it while the room is in the lobby. The server sanitizes it using the existing 24-character safe-name rule and replicates the resulting value to every client.

Each human roster slot gains a server-authoritative ready flag. A player must have a non-empty name and a selected playable character before Ready can be enabled. Pressing Ready updates only that player's slot and every roster card shows its current status. Editing that player's name, team, or character clears their ready flag. Bot slots never require readiness.

### Start permission

The first human who creates a room is its creator. In the waiting phase, the server accepts a start request only from that creator and only when every connected human is ready. The creator sees an enabled Start Match control only after that condition holds; all players can see who is still not ready. This applies to private and quick-match rooms alike.

### Stable identity-ring colors

Human identity rings are assigned using the server-replicated, deterministic roster join order with a slot-ID tie break, rather than ordering the local player first. The ring follows the same human through a control switch or temporary goalie-control grant. Bot skaters remain identified by their blue/red team uniforms and have no identity ring.

## Stick controls

The client transforms only its local vertical stick axis before local prediction and network transmission. By default, the home/blue team retains the current orientation and the away/red team receives the mirrored orientation: down shoots and up pulls back for power. A persisted Settings control named Always Up Stick Controls overrides the team flip, so up shoots for both teams. Horizontal stick behavior remains unchanged.

## Error handling and invariants

- The server rejects ready, name, or start messages from clients without a human roster slot.
- Name updates, team changes, and character updates are lobby-only; a live match remains immutable to those messages.
- A creator disconnecting during the existing reconnection grace remains the creator if that session reconnects. If the creator leaves deliberately, creator authority transfers to the earliest remaining human by shared join order.
- Identity colors never depend on a local session ID, so all clients derive the same map from the same replicated roster.

## Verification

- Core simulation tests prove wider assisted selection, faster lead passes, successful faster teammate reception, expanded ordinary pickup reach, unchanged cooldown windows, and the 11,250 ms power-up cadence.
- Server room tests cover sanitized name updates, ready reset rules, host-only start, all-human-ready gating, and creator transfer.
- Client tests cover persisted naming, ready presentation, automatic red stick inversion, Always Up override, and identical ring maps from the same roster regardless of local session.

## Out of scope

- Per-player custom ring-color selection.
- Automatic match start.
- Changing team uniform colors or bot team assignment.
- Removing charged passes, defender interceptions, or defensive loose-puck windows.
