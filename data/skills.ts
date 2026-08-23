export interface Skill {
  id: string;
  name: string;
  description: string;
  cost: number;
  requires: string[];
}

export const SKILLS: Skill[] = [
  {
    id: "ojo-certero",
    name: "Ojo Certero",
    description: "Las pistas restan 20% de XP en vez de 40%.",
    cost: 1,
    requires: []
  },
  {
    id: "estudio-rapido",
    name: "Estudio Rápido",
    description: "+15% de XP en cada bug resuelto.",
    cost: 1,
    requires: []
  },
  {
    id: "bonus-mision",
    name: "Bonus de Misión",
    description: "+25% de XP en el bono de misión completa.",
    cost: 1,
    requires: ["estudio-rapido"]
  },
  {
    id: "instinto-jefe",
    name: "Instinto de Jefe",
    description: "+50% de XP extra en la misión jefe (Misión 7).",
    cost: 2,
    requires: ["ojo-certero", "bonus-mision"]
  }
];
