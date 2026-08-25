<script setup lang="ts">
import { EXERCISES, type Exercise } from "~/data/exercises";
import { MODULES, moduleFor } from "~/data/modules";
import { useGameState } from "~/composables/useGameState";

const { state, exState, isUnlocked, setActive, chapterExercises } = useGameState();

const groups = computed(() =>
  MODULES.filter((m) => m.id !== "capitulo")
    .map((m) => ({
      mod: m,
      items: EXERCISES.map((ex, idx) => ({ ex, idx })).filter(({ ex }) => ex.topic === m.id && !ex.boss)
    }))
    .concat([{ mod: null as any, items: EXERCISES.map((ex, idx) => ({ ex, idx })).filter(({ ex }) => ex.boss) }])
);

/** Capítulos del docente, agrupados por chapterId — siempre desbloqueados
 * (no forman parte de la progresión lineal de las 7 misiones fijas). */
const chapterGroups = computed(() => {
  const byId = new Map<string, { title: string; items: { ex: Exercise; idx: number }[] }>();
  chapterExercises.forEach((ex, idx) => {
    const key = ex.chapterId ?? "sin-capitulo";
    if (!byId.has(key)) byId.set(key, { title: ex.chapterTitle ?? "Capítulo", items: [] });
    byId.get(key)!.items.push({ ex, idx });
  });
  return [...byId.values()];
});
</script>

<template>
  <div class="quest-groups">
    <div v-for="group in groups" :key="group.mod ? group.mod.id : 'boss'" class="group">
      <div
        class="group-label"
        :style="{ color: group.mod ? group.mod.color : '#ff3fa4' }"
      >
        {{ group.mod ? group.mod.title : "Jefe final" }}
      </div>
      <div class="quest-tabs">
        <button
          v-for="{ ex, idx } in group.items"
          :key="ex.id"
          v-motion
          :initial="{ opacity: 0, y: 12, scale: 0.85 }"
          :enter="{ opacity: 1, y: 0, scale: 1, transition: { delay: idx * 60, type: 'spring', stiffness: 260, damping: 18 } }"
          :hovered="!isUnlocked(idx) ? {} : { scale: 1.08, y: -3 }"
          :tapped="!isUnlocked(idx) ? {} : { scale: 0.92 }"
          class="quest-tab"
          :class="{
            active: ex.id === state.activeId,
            done: exState(ex.id).completed,
            locked: !isUnlocked(idx),
            boss: ex.boss
          }"
          :style="{ '--tab-color': moduleFor(ex.topic).color }"
          :disabled="!isUnlocked(idx)"
          :title="ex.title"
          @click="setActive(ex.id)"
        >
          {{ ex.boss ? "👑" : `M${idx + 1}` }}
        </button>
      </div>
    </div>

    <div v-for="chGroup in chapterGroups" :key="chGroup.title" class="group">
      <div class="group-label" style="color: var(--cream-dim)">📘 {{ chGroup.title }}</div>
      <div class="quest-tabs">
        <button
          v-for="({ ex }, i) in chGroup.items"
          :key="ex.id"
          v-motion
          :hovered="{ scale: 1.08, y: -3 }"
          :tapped="{ scale: 0.92 }"
          class="quest-tab"
          :class="{ active: ex.id === state.activeId, done: exState(ex.id).completed }"
          :style="{ '--tab-color': moduleFor(ex.topic).color }"
          :title="`${ex.title} — ${moduleFor(ex.topic).short}`"
          @click="setActive(ex.id)"
        >
          C{{ i + 1 }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quest-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.4rem;
  align-items: flex-start;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.group-label {
  font-family: "VT323", monospace;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.quest-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.quest-tab {
  font-family: "VT323", monospace;
  font-size: 1rem;
  background: var(--bg-panel);
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  color: var(--cream-dim);
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  position: relative;
  transition: transform 0.12s;
}
.quest-tab.active {
  border-color: var(--tab-color, var(--amber));
  color: var(--tab-color, var(--amber));
  background: color-mix(in srgb, var(--tab-color, var(--amber)) 12%, transparent);
}
.quest-tab.done::after {
  content: "✓";
  color: var(--cyan);
  margin-left: 0.4rem;
}
.quest-tab.locked {
  opacity: 0.35;
  cursor: not-allowed;
}
.quest-tab.boss {
  border-color: #ff3fa4;
}
</style>
