<script setup lang="ts">
import { useTheoryChapters, type ExerciseSetRow } from "~/composables/useChapters";
import { useGameState } from "~/composables/useGameState";

// El material previo del aula invertida: lo que el alumno lee ANTES de la
// clase. No se compila ni da XP de combate — es lectura + un par de preguntas
// de comprensión cortas que funcionan como "ticket de entrada".
const theoryChapters = useTheoryChapters();
const { markTheoryDone, isTheoryDone, state } = useGameState();

const openId = ref<string | null>(null);
/** Respuesta elegida por pregunta, para el capítulo abierto. */
const answers = ref<Record<number, number>>({});
const checked = ref(false);

function toggle(ch: ExerciseSetRow) {
  openId.value = openId.value === ch.id ? null : ch.id;
  answers.value = {};
  checked.value = false;
}

const openChapter = computed(() => theoryChapters.find((c) => c.id === openId.value) ?? null);
const openChecks = computed(() => openChapter.value?.content?.checks ?? []);

const score = computed(
  () => openChecks.value.filter((chk, i) => answers.value[i] === chk.correctIndex).length
);
const allAnswered = computed(
  () => openChecks.value.length > 0 && openChecks.value.every((_, i) => answers.value[i] !== undefined)
);

function submitChecks() {
  if (!openChapter.value) return;
  checked.value = true;
  markTheoryDone(openChapter.value.id, score.value, openChecks.value.length);
}

/** Si no hay preguntas, el material se marca leído con un botón simple. */
function markRead() {
  if (!openChapter.value) return;
  markTheoryDone(openChapter.value.id, 0, 0);
  checked.value = true;
}

function dueLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const overdue = d.getTime() < Date.now();
  const txt = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
  return `${overdue ? "venció" : "para"} el ${txt}`;
}
function isOverdue(iso: string | null): boolean {
  return !!iso && new Date(iso).getTime() < Date.now();
}
</script>

<template>
  <section v-if="theoryChapters.length > 0" class="theory pxframe pxborder">
    <h2 class="theory-title">📖 Material previo</h2>
    <p class="theory-sub">Leé esto antes de la clase. Después vienen los ejercicios.</p>

    <div v-for="ch in theoryChapters" :key="ch.id" class="chapter">
      <button class="chapter-head" :class="{ open: openId === ch.id }" @click="toggle(ch)">
        <span class="chapter-check" :class="{ done: isTheoryDone(ch.id) }">
          {{ isTheoryDone(ch.id) ? "✔" : "○" }}
        </span>
        <span class="chapter-name">{{ ch.title }}</span>
        <span v-if="ch.due_at" class="chapter-due" :class="{ overdue: isOverdue(ch.due_at) && !isTheoryDone(ch.id) }">
          ⏰ {{ dueLabel(ch.due_at) }}
        </span>
        <span class="chapter-arrow">{{ openId === ch.id ? "▾" : "▸" }}</span>
      </button>

      <div v-if="openId === ch.id" class="chapter-body">
        <div v-for="(sec, i) in ch.content?.sections ?? []" :key="i" class="section">
          <h3>{{ sec.heading }}</h3>
          <div class="section-body" v-html="sec.body" />
        </div>

        <template v-if="openChecks.length">
          <h3 class="checks-title">¿Se entendió?</h3>
          <div v-for="(chk, i) in openChecks" :key="i" class="check">
            <p class="question">{{ i + 1 }}. {{ chk.question }}</p>
            <label
              v-for="(opt, j) in chk.options"
              :key="j"
              class="option"
              :class="{
                correct: checked && j === chk.correctIndex,
                wrong: checked && answers[i] === j && j !== chk.correctIndex
              }"
            >
              <input
                type="radio"
                :name="`q-${ch.id}-${i}`"
                :disabled="checked"
                :checked="answers[i] === j"
                @change="answers[i] = j"
              />
              <span>{{ opt }}</span>
            </label>
          </div>

          <button v-if="!checked" class="btn" :disabled="!allAnswered" @click="submitChecks">
            {{ allAnswered ? "Verificar" : "Respondé todas para verificar" }}
          </button>
          <p v-else class="result" :class="{ perfect: score === openChecks.length }">
            {{ score }}/{{ openChecks.length }} correctas.
            {{ score === openChecks.length ? "¡Listo, podés arrancar los ejercicios!" : "Repasá lo que quedó en rojo." }}
          </p>
        </template>

        <template v-else>
          <button v-if="!isTheoryDone(ch.id)" class="btn" @click="markRead">Marcar como leído</button>
          <p v-else class="result">✔ Marcado como leído.</p>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.theory {
  background: var(--bg-panel);
  padding: 1.1rem 1.2rem;
}
.theory-title {
  font-family: "Press Start 2P", monospace;
  color: var(--cyan);
  font-size: 0.9rem;
  margin: 0 0 0.4rem;
}
.theory-sub {
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 1rem;
  margin: 0 0 0.9rem;
}
.chapter {
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  margin-bottom: 0.6rem;
}
.chapter-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.6rem 0.7rem;
  font-family: "VT323", monospace;
  font-size: 1.1rem;
  color: var(--cream);
  text-align: left;
}
.chapter-head.open {
  background: rgba(94, 234, 212, 0.06);
}
.chapter-check {
  color: var(--cream-dim);
  flex: none;
}
.chapter-check.done {
  color: var(--cyan);
}
.chapter-name {
  flex: 1;
}
.chapter-due {
  font-size: 0.85rem;
  color: var(--cream-dim);
  flex: none;
}
.chapter-due.overdue {
  color: var(--magenta);
}
.chapter-arrow {
  color: var(--cream-dim);
  flex: none;
}
.chapter-body {
  padding: 0.3rem 0.9rem 0.9rem;
  border-top: 1px dashed var(--border-dark);
}
.section h3 {
  font-family: "VT323", monospace;
  color: var(--amber);
  font-size: 1.15rem;
  margin: 0.9rem 0 0.3rem;
}
.section-body :deep(p),
.section-body :deep(li) {
  color: var(--cream-dim);
  font-size: 0.92rem;
  line-height: 1.55;
}
.section-body :deep(code) {
  background: #0a0810;
  padding: 0.05rem 0.3rem;
  color: var(--amber);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.85em;
}
.checks-title {
  font-family: "Press Start 2P", monospace;
  color: var(--cyan);
  font-size: 0.7rem;
  margin: 1.2rem 0 0.6rem;
  padding-top: 0.8rem;
  border-top: 1px dashed var(--border-dark);
}
.check {
  margin-bottom: 0.9rem;
}
.question {
  font-family: "VT323", monospace;
  color: var(--cream);
  font-size: 1.05rem;
  margin: 0 0 0.35rem;
}
.option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 1rem;
  padding: 0.22rem 0.4rem;
  cursor: pointer;
  border: 1px solid transparent;
}
.option.correct {
  border-color: var(--cyan);
  color: var(--cyan);
}
.option.wrong {
  border-color: var(--magenta);
  color: var(--magenta);
}
.btn {
  font-family: "Press Start 2P", monospace;
  font-size: 0.65rem;
  padding: 0.6rem 0.9rem;
  cursor: pointer;
  border: 2px solid var(--border-dark);
  outline: 2px solid var(--amber);
  outline-offset: -4px;
  background: var(--amber);
  color: #1a1509;
  font-weight: 700;
  margin-top: 0.5rem;
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.result {
  font-family: "VT323", monospace;
  font-size: 1.05rem;
  color: var(--cream-dim);
  margin: 0.7rem 0 0;
}
.result.perfect {
  color: var(--cyan);
}
</style>
