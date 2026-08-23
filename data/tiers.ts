export interface Tier {
  min: number;
  max: number;
  title: string;
  tier: number;
}

export const TIERS: Tier[] = [
  { min: 1, max: 2, title: "Cadete de Sintaxis", tier: 1 },
  { min: 3, max: 5, title: "Cazador de Bugs", tier: 2 },
  { min: 6, max: 8, title: "Ingeniero de Vectores", tier: 3 },
  { min: 9, max: 11, title: "Arquitecto de Ciclos", tier: 4 },
  { min: 12, max: 999, title: "Archimago del Compilador", tier: 5 }
];

export const XP_PER_LEVEL = 150;

export function levelFromXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function tierForLevel(level: number): Tier {
  return TIERS.find((t) => level >= t.min && level <= t.max) ?? TIERS[TIERS.length - 1];
}
