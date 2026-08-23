import type { Topic } from "~/data/modules";

export type UnlockCondition =
  | { type: "level"; value: number }
  | { type: "badge"; value: "firstBug" | "fiveBugs" | "noHint" | "allComplete" };

export interface EquipItem {
  id: string;
  name: string;
  description: string;
  color: string;
  image?: string;
  glow?: boolean;
  unlock: UnlockCondition;
  /** Afinidad de tipo para el sistema de batalla: si coincide con el tema
   * del ejercicio activo, el golpe es "muy efectivo" (+50% XP). "universal"
   * siempre es efectiva; sin este campo, el arma es neutral. */
  affinity?: Topic | "universal";
}

export interface PetItem extends EquipItem {
  shape: "slime" | "drone" | "phoenix" | "dragon";
}

export const WEAPONS: EquipItem[] = [
  {
    id: "daga",
    name: "Daga de Sintaxis",
    description: "Tu primera arma. Neutral: no tiene ventaja contra ningún tema, pero tampoco desventaja.",
    color: "#9a8f7a",
    image: "/sprites/weapon_daga.png",
    unlock: { type: "level", value: 1 }
  },
  {
    id: "espada-corta",
    name: "Espada del Bucle",
    description: "Forjada resolviendo tu primer bucle infinito. Muy efectiva contra bugs de Ciclos.",
    color: "#ffb000",
    image: "/sprites/weapon_espada-corta.png",
    unlock: { type: "level", value: 2 },
    affinity: "ciclos"
  },
  {
    id: "espada-larga",
    name: "Espada de Vectores",
    description: "Filo largo, ideal para recorrer un vector de punta a punta. Muy efectiva contra bugs de Vectores.",
    color: "#5eead4",
    image: "/sprites/weapon_espada-larga.png",
    unlock: { type: "level", value: 3 },
    affinity: "vectores"
  },
  {
    id: "espada-runica",
    name: "Espada Rúnica de Operadores",
    description: "Graba en su hoja cada operador que aprendiste. Muy efectiva contra bugs de Operadores.",
    color: "#ff3fa4",
    image: "/sprites/weapon_espada-runica.png",
    unlock: { type: "level", value: 4 },
    affinity: "operadores"
  },
  {
    id: "excalibur",
    name: "Excálibur de Bits",
    description: "Solo la empuñan quienes ya dominan todo el programa. Siempre es muy efectiva.",
    color: "#fff2c2",
    image: "/sprites/weapon_excalibur.png",
    glow: true,
    unlock: { type: "level", value: 5 },
    affinity: "universal"
  }
];

export const ARMORS: EquipItem[] = [
  {
    id: "peto-cadete",
    name: "Peto de Cadete",
    description: "Placas básicas. Mejor que nada.",
    color: "#8a6300",
    image: "/sprites/shield_peto-cadete.png",
    unlock: { type: "level", value: 2 }
  },
  {
    id: "placas-reforzadas",
    name: "Placas Reforzadas",
    description: "Resisten un buen par de compilaciones fallidas.",
    color: "#c98600",
    image: "/sprites/shield_placas-reforzadas.png",
    unlock: { type: "level", value: 4 }
  },
  {
    id: "armadura-ingeniero",
    name: "Armadura de Ingeniero",
    description: "Diseñada para sobrevivir a la gestión de memoria.",
    color: "#5eead4",
    image: "/sprites/shield_armadura-ingeniero.png",
    unlock: { type: "level", value: 7 }
  },
  {
    id: "armadura-arcana",
    name: "Armadura Arcana",
    description: "Tejida con hilos de lógica booleana.",
    color: "#ff3fa4",
    image: "/sprites/shield_armadura-arcana.png",
    unlock: { type: "level", value: 10 }
  },
  {
    id: "armadura-archimago",
    name: "Armadura del Archimago",
    description: "La última línea de defensa antes del undefined behavior.",
    color: "#ffe08a",
    image: "/sprites/shield_armadura-archimago.png",
    glow: true,
    unlock: { type: "level", value: 12 }
  }
];

export const PETS: PetItem[] = [
  {
    id: "chispita",
    name: "Chispita",
    description: "Un slime de sintaxis que te acompaña desde el día uno.",
    color: "#8a6300",
    shape: "slime",
    unlock: { type: "level", value: 1 }
  },
  {
    id: "vector",
    name: "Vector",
    description: "Dron cazabugs. Nació de tu primer bug resuelto.",
    color: "#5eead4",
    shape: "drone",
    unlock: { type: "badge", value: "firstBug" }
  },
  {
    id: "flama",
    name: "Flama",
    description: "Un ave que solo aparece si resolvés una misión sin pedir pistas.",
    color: "#ffb000",
    shape: "phoenix",
    unlock: { type: "badge", value: "noHint" }
  },
  {
    id: "nova",
    name: "Nova",
    description: "Cría de dragón compilador. Solo se une a debuggers perfectos.",
    color: "#ff3fa4",
    shape: "dragon",
    unlock: { type: "badge", value: "allComplete" }
  }
];
