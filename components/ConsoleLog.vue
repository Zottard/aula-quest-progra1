<script setup lang="ts">
import type { ExerciseState } from "~/composables/useGameState";

const props = defineProps<{ log: ExerciseState["log"] }>();
const boxRef = ref<HTMLElement | null>(null);

watch(
  () => props.log.length,
  async () => {
    await nextTick();
    if (boxRef.value) boxRef.value.scrollTop = boxRef.value.scrollHeight;
  }
);
</script>

<template>
  <div ref="boxRef" class="console">
    <div v-if="props.log.length === 0" class="line sys">$ esperando compilación...</div>
    <div v-for="(l, i) in props.log" :key="i" class="line" :class="l.type">{{ l.text }}</div>
  </div>
</template>

<style scoped>
.console {
  margin-top: 1rem;
  background: #08060c;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  padding: 0.7rem 0.9rem;
  font-family: "VT323", monospace;
  font-size: 1.05rem;
  max-height: 190px;
  overflow-y: auto;
}
.line {
  padding: 0.15rem 0;
  border-bottom: 1px dashed #241d33;
  opacity: 0;
  animation: lineIn 0.3s ease forwards;
}
.line:last-child {
  border-bottom: none;
}
.ok {
  color: var(--cyan);
}
.err {
  color: var(--red);
}
.sys {
  color: var(--cream-dim);
}
.boss {
  color: var(--magenta);
}
</style>
