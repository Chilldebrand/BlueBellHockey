import type { CSSProperties, ReactNode } from 'react';
import { getCharacter } from '@bbh/shared';
import { net } from '../net/client.js';
import { useUi, type PlayerStatLine, type RosterIdentity } from '../store.js';

const EMPTY: PlayerStatLine = { goals: 0, assists: 0, hits: 0, takeaways: 0, saves: 0, shots: 0 };

// A single number that weighs a skater's box score into a "most valuable" pick.
// Goals and helpers lead; takeaways/hits round out two-way play. The winning side
// gets a thumb on the scale so a losing player rarely steals MVP.
function mvpScore(s: PlayerStatLine, won: boolean): number {
  return s.goals * 3 + s.assists * 2 + s.takeaways * 1.2 + s.hits * 0.6 + (won ? 2 : 0);
}

function charName(id: string): string {
  try {
    return getCharacter(id).name;
  } catch {
    return id;
  }
}
function jerseyOf(id: string): string {
  try {
    return getCharacter(id).jersey;
  } catch {
    return '#888';
  }
}

export function Postgame() {
  const roster = useUi((s) => s.roster);
  const stats = useUi((s) => s.stats);
  const score0 = useUi((s) => s.score0);
  const score1 = useUi((s) => s.score1);

  const winner = score0 === score1 ? -1 : score0 > score1 ? 0 : 1;
  const lineOf = (id: string) => stats[id] ?? EMPTY;

  // MVP across both teams — skaters only (goalies are bots; MVP celebrates players).
  let mvp: RosterIdentity | null = null;
  let mvpVal = -Infinity;
  for (const r of roster) {
    if (r.isGoalie) continue;
    const val = mvpScore(lineOf(r.id), r.team === winner);
    if (val > mvpVal) {
      mvpVal = val;
      mvp = r;
    }
  }

  const title = winner === -1 ? 'DRAW' : winner === 0 ? 'HOME WINS' : 'AWAY WINS';
  const titleColor = winner === 1 ? '#ff5a3c' : winner === 0 ? '#3c6bff' : '#dfe6ff';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(4,7,18,0.86)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        pointerEvents: 'auto',
        overflow: 'auto',
        padding: 24,
      }}
    >
      <div style={{ fontSize: 18, letterSpacing: 4, opacity: 0.7 }}>FINAL</div>
      <div style={{ fontSize: 56, fontWeight: 900, color: titleColor, lineHeight: 1 }}>{title}</div>
      <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: '#3c6bff' }}>{score0}</span>
        <span style={{ opacity: 0.5, margin: '0 14px' }}>–</span>
        <span style={{ color: '#ff5a3c' }}>{score1}</span>
      </div>

      {mvp && <MvpCard r={mvp} line={lineOf(mvp.id)} />}

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
        <TeamBox name="HOME" color="#3c6bff" team={0} roster={roster} lineOf={lineOf} />
        <TeamBox name="AWAY" color="#ff5a3c" team={1} roster={roster} lineOf={lineOf} />
      </div>

      <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
        <button onClick={() => net.rematch()} style={btn('#27c93f', '#062')}>
          REMATCH ▶
        </button>
        <button onClick={() => net.backToLobby()} style={btn('transparent', '#aeb8e8', '#2a3566')}>
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

function MvpCard({ r, line }: { r: RosterIdentity; line: PlayerStatLine }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 22px',
        borderRadius: 14,
        background: 'rgba(255,210,60,0.10)',
        border: '1px solid #ffd23c',
        boxShadow: '0 0 30px rgba(255,210,60,0.25)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, color: '#ffd23c', letterSpacing: 2 }}>★ MVP</div>
      <span style={{ width: 14, height: 14, borderRadius: 4, background: jerseyOf(r.characterId) }} />
      <strong style={{ fontSize: 20 }}>{charName(r.characterId)}</strong>
      <span style={{ opacity: 0.85, fontSize: 14 }}>
        {line.goals}G · {line.assists}A
        {line.saves > 0 ? ` · ${line.saves} SV` : ''}
        {line.takeaways > 0 ? ` · ${line.takeaways} TK` : ''}
      </span>
    </div>
  );
}

function TeamBox({
  name,
  color,
  team,
  roster,
  lineOf,
}: {
  name: string;
  color: string;
  team: number;
  roster: RosterIdentity[];
  lineOf: (id: string) => PlayerStatLine;
}) {
  const players = roster
    .filter((r) => r.team === team)
    .sort((a, b) => Number(a.isGoalie) - Number(b.isGoalie)); // skaters first, goalie last

  return (
    <div
      style={{
        background: 'rgba(10,16,40,0.7)',
        border: `1px solid ${color}55`,
        borderRadius: 12,
        padding: 12,
        minWidth: 320,
      }}
    >
      <div style={{ color, fontWeight: 800, marginBottom: 6, letterSpacing: 1 }}>{name}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr style={{ fontSize: 11, opacity: 0.55, textAlign: 'right' }}>
            <th style={{ textAlign: 'left', fontWeight: 600 }}>Skater</th>
            <Th>G</Th>
            <Th>A</Th>
            <Th>SOG</Th>
            <Th>HIT</Th>
            <Th>TK</Th>
            <Th>SV</Th>
          </tr>
        </thead>
        <tbody>
          {players.map((r) => {
            const s = lineOf(r.id);
            return (
              <tr key={r.id} style={{ fontSize: 13 }}>
                <td style={{ padding: '3px 0', whiteSpace: 'nowrap' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      background: jerseyOf(r.characterId),
                      marginRight: 7,
                    }}
                  />
                  {charName(r.characterId)}
                  {r.isGoalie && <span style={{ opacity: 0.5, fontSize: 10 }}> (G)</span>}
                </td>
                <Td>{s.goals}</Td>
                <Td>{s.assists}</Td>
                <Td dim>{s.shots}</Td>
                <Td dim>{s.hits}</Td>
                <Td>{s.takeaways}</Td>
                <Td>{s.saves}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th style={{ fontWeight: 600, padding: '0 0 0 10px', width: 34 }}>{children}</th>;
}
function Td({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <td style={{ textAlign: 'right', padding: '3px 0 3px 10px', opacity: dim ? 0.6 : 1 }}>
      {children}
    </td>
  );
}

function btn(bg: string, color: string, border?: string): CSSProperties {
  return {
    padding: '12px 30px',
    fontSize: 16,
    fontWeight: 800,
    background: bg,
    border: border ? `1px solid ${border}` : 'none',
    borderRadius: 10,
    color,
    cursor: 'pointer',
  };
}
