<script setup lang="ts">
import { useAutoAnimate } from "@formkit/auto-animate/vue";
import type { Exercise } from "~/data/exercises";
import type { ExerciseState } from "~/composables/useGameState";

const props = defineProps<{ exercise: Exercise; exState: ExerciseState; justSolvedId: string | null }>();
const emit = defineEmits<{ hint: [bugId: string] }>();

const [listRef] = useAutoAnimate({ duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" });
</script>

<template>
  <div ref="listRef" class="bug-list">
    <div
      v-for="bug in props.exercise.bugs"
      :key="bug.id"
      class="bug-item"
      :data-bug="bug.id"
      :class="{ solved: props.exState.solved[bug.id], zap: bug.id === props.justSolvedId }"
    >
      <div>
        <div>
          {{ props.exState.solved[bug.id] ? "✔" : "🐞" }} {{ bug.label
          }}{{ props.exState.solved[bug.id] ? " — resuelto" : "" }}
        </div>
        <span v-if="props.exState.hinted[bug.id] && !props.exState.solved[bug.id]" class="hint-text">
          💡 {{ bug.hint }}
        </span>
        <span v-if="props.exState.solved[bug.id]" class="hint-text">{{ bug.explanation }}</span>
      </div>
      <button
        v-if="!props.exState.solved[bug.id]"
        v-motion
        :hovered="{ scale: 1.08 }"
        :tapped="{ scale: 0.88 }"
        class="hint-btn"
        @click="emit('hint', bug.id)"
      >
        {{ props.exState.hinted[bug.id] ? "pista usada" : "pedir pista" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.bug-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.bug-item {
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  padding: 0.55rem 0.7rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  font-family: "VT323", monospace;
  font-size: 1.05rem;
  transition: background 0.3s;
}
.bug-item.solved {
  outline-color: var(--cyan);
  color: var(--cyan);
  background: rgba(94, 234, 212, 0.07);
}
.bug-item.zap {
  animation: zap 0.5s ease;
}
@keyframes zap {
  0% {
    background: rgba(94, 234, 212, 0.5);
  }
  100% {
    background: rgba(94, 234, 212, 0.07);
  }
}
.bug-item .hint-btn {
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  background: none;
  border: 1px solid var(--amber-dim);
  color: var(--amber-dim);
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  white-space: nowrap;
}
.bug-item .hint-text {
  display: block;
  color: var(--cream-dim);
  font-size: 0.92rem;
  margin-top: 0.3rem;
}
</style>
