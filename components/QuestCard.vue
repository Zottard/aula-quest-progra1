<script setup lang="ts">
import { useGameState } from "~/composables/useGameState";

const { state, exState, saveCode, checkCode, compiling, resetCode, useHint, findExercise } = useGameState();

const exercise = computed(() => findExercise(state.activeId)!);
const isChapter = computed(() => !!exercise.value.testCases);
const es = computed(() => exState(exercise.value.id));
const isCompiling = computed(() => !!compiling[exercise.value.id]);

const code = ref(es.value.savedCode ?? exercise.value.code);
const justCompleted = ref(false);
const cardRef = ref<HTMLElement | null>(null);
const shake = ref(false);

// Cuando cambia la misión activa, cargamos su código guardado (o el original).
watch(
  () => exercise.value.id,
  () => {
    code.value = es.value.savedCode ?? exercise.value.code;
    justCompleted.value = false;
  }
);

watch(code, (val) => saveCode(exercise.value.id, val));

const gutterLines = computed(() => exercise.value.code.split("\n").map((_, i) => i + 1).join("\n"));

async function handleCheck() {
  if (isCompiling.value) return;
  const wasCompleted = es.value.completed;
  await checkCode(exercise.value.id, code.value);

  if (!wasCompleted && es.value.completed) {
    justCompleted.value = true;
  } else {
    justCompleted.value = false;
    shake.value = false;
    requestAnimationFrame(() => (shake.value = true));
    setTimeout(() => (shake.value = false), 400);
  }
}

function handleReset() {
  resetCode(exercise.value.id);
  code.value = exercise.value.code;
}

function handleHint(bugId: string) {
  useHint(exercise.value.id, bugId);
}
</script>

<template>
  <div>
    <div
      v-motion
      :initial="{ opacity: 0, y: -14 }"
      :enter="{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 22 } }"
      class="card pxframe pxborder"
    >
      <details class="briefing" open>
        <summary>📎 Material previo (aula invertida) — {{ exercise.concept }}</summary>
        <div v-html="exercise.briefing" />
      </details>
    </div>

    <div
      ref="cardRef"
      v-motion
      :initial="{ opacity: 0, y: 18 }"
      :enter="{ opacity: 1, y: 0, transition: { delay: 90, type: 'spring', stiffness: 200, damping: 22 } }"
      class="card pxframe pxborder"
      :class="{ shake }"
      style="margin-top: 1rem"
    >
      <h2 class="quest-title">{{ exercise.boss ? "👑 " : "" }}{{ exercise.title }}</h2>
      <p v-if="isChapter" class="quest-sub">
        Escribí el programa completo a partir del enunciado y compilá para verificar
        ({{ exercise.testCases!.length }} caso{{ exercise.testCases!.length > 1 ? "s" : "" }} de prueba).
      </p>
      <p v-else class="quest-sub">
        {{ exercise.bugs.length }} bug{{ exercise.bugs.length > 1 ? "s" : "" }} escondido{{
          exercise.bugs.length > 1 ? "s" : ""
        }}
        en este código. Editalo directamente y compilá para verificar.
      </p>

      <div class="editor-wrap pxframe">
        <div class="gutter">{{ gutterLines }}</div>
        <textarea v-model="code" class="code-input" spellcheck="false" />
      </div>

      <div class="actions-row">
        <button
          v-motion
          :hovered="{ scale: 1.06, y: -2 }"
          :tapped="{ scale: 0.9, rotate: -2 }"
          class="btn"
          :disabled="isCompiling"
          @click="handleCheck"
        >
          {{ isCompiling ? "⏳ COMPILANDO…" : "▶ COMPILAR" }}
        </button>
        <button v-motion :hovered="{ scale: 1.06 }" :tapped="{ scale: 0.9 }" class="btn ghost" @click="handleReset">
          ↺ REINICIAR
        </button>
      </div>

      <BugList v-if="!isChapter" :exercise="exercise" :ex-state="es" :just-completed="justCompleted" @hint="handleHint" />
      <ConsoleLog :log="es.log" />
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--bg-panel);
  padding: 1.1rem 1.2rem;
}
.card.shake {
  animation: shake 0.4s ease;
}
.briefing summary {
  cursor: pointer;
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 1.05rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.briefing :deep(p),
.briefing :deep(li) {
  color: var(--cream-dim);
  font-size: 0.92rem;
  line-height: 1.55;
}
.briefing :deep(code) {
  background: #0a0810;
  padding: 0.05rem 0.3rem;
  color: var(--amber);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.85em;
}
.quest-title {
  font-family: "Press Start 2P", monospace;
  color: var(--amber);
  font-size: 1rem;
  margin: 0 0 0.5rem;
  line-height: 1.6;
}
.quest-sub {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 1.05rem;
  margin: 0 0 0.9rem;
}
.editor-wrap {
  display: flex;
  background: var(--bg-editor);
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  overflow: hidden;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.86rem;
}
.gutter {
  padding: 0.85rem 0.6rem;
  text-align: right;
  color: #4a3d5e;
  user-select: none;
  background: #08060c;
  white-space: pre;
  line-height: 1.55;
}
.code-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: vertical;
  color: var(--cream);
  padding: 0.85rem 0.9rem;
  line-height: 1.55;
  min-height: 220px;
  font-family: inherit;
  font-size: inherit;
  tab-size: 4;
}
.actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.9rem;
}
.btn {
  font-family: "Press Start 2P", monospace;
  font-size: 0.7rem;
  padding: 0.65rem 1rem;
  cursor: pointer;
  border: 2px solid var(--border-dark);
  outline: 2px solid var(--amber);
  outline-offset: -4px;
  background: var(--amber);
  color: #1a1509;
  font-weight: 700;
  transition: transform 0.12s;
}
.btn.ghost {
  background: var(--bg-panel);
  color: var(--cream-dim);
  outline-color: var(--border-light);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
