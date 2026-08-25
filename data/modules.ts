// Cada módulo = un tema del programa de Programación 1 = un "tipo" de batalla.
// El sistema de efectividad (como en los juegos de monstruitos) usa estos tipos:
// el arma equipada tiene una afinidad de tipo, y si coincide con el tema del
// ejercicio activo, el golpe es "muy efectivo" (bonus de XP).
// "capitulo" no es un tema del programa fijo, sino el "tipo" genérico que
// usan los ejercicios que un docente generó a partir de un PDF (ver
// composables/useChapters.ts) — siempre neutral en el sistema de batalla,
// ningún arma tiene afinidad especial contra él.
export type Topic = "operadores" | "ciclos" | "vectores" | "capitulo";

export interface ModuleInfo {
  id: Topic;
  title: string;
  short: string;
  color: string;
  enemySprite: string;
  description: string;
}

export const MODULES: ModuleInfo[] = [
  {
    id: "operadores",
    title: "Módulo 1 · Operadores",
    short: "Operadores",
    color: "#ff3fa4",
    enemySprite: "/sprites/enemy_operadores.png",
    description: "Asignación, comparación y operadores aritméticos."
  },
  {
    id: "ciclos",
    title: "Módulo 2 · Ciclos for",
    short: "Ciclos",
    color: "#ffb000",
    enemySprite: "/sprites/enemy_ciclos.png",
    description: "Bucles for: condición de corte e incremento."
  },
  {
    id: "vectores",
    title: "Módulo 3 · Vectores",
    short: "Vectores",
    color: "#5eead4",
    enemySprite: "/sprites/enemy_vectores.png",
    description: "Arrays: recorrido, límites y búsqueda."
  },
  {
    id: "capitulo",
    title: "Capítulo del profe",
    short: "Capítulo",
    color: "#b0a8c2",
    enemySprite: "/sprites/enemy_operadores.png",
    description: "Ejercicios armados por tu docente a partir de una guía."
  }
];

export function moduleFor(topic: Topic): ModuleInfo {
  return MODULES.find((m) => m.id === topic) ?? MODULES[0];
}
