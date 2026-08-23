// Cada módulo = un tema del programa de Programación 1 = un "tipo" de batalla.
// El sistema de efectividad (como en los juegos de monstruitos) usa estos tipos:
// el arma equipada tiene una afinidad de tipo, y si coincide con el tema del
// ejercicio activo, el golpe es "muy efectivo" (bonus de XP).
export type Topic = "operadores" | "ciclos" | "vectores";

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
  }
];

export function moduleFor(topic: Topic): ModuleInfo {
  return MODULES.find((m) => m.id === topic) ?? MODULES[0];
}
