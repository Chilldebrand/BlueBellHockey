import type { Team } from '@bbh/shared';

export interface FieldSlot {
  id: string;
  team: Team;
}

export function canTeamControl({
  locked,
  humansOnTeam,
}: {
  locked: boolean;
  humansOnTeam: number;
}): boolean {
  return !locked && humansOnTeam === 1;
}

export function nextSkaterOnTeam(slots: FieldSlot[], currentId: string, team: Team): string {
  const teamSlots = slots.filter((s) => s.team === team);
  if (teamSlots.length === 0) return currentId;
  const current = teamSlots.findIndex((s) => s.id === currentId);
  return teamSlots[(current + 1 + teamSlots.length) % teamSlots.length].id;
}
