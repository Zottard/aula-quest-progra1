<script setup lang="ts">
import { EXERCISES } from "~/data/exercises";
import { useGameState } from "~/composables/useGameState";
import { askForHelp } from "~/composables/useStudentQuestions";

const { state, exState, saveCode, checkCode, compiling, resetCode, useHint, findExercise, isLinkedToAula } =
  useGameState();

// Fallback a la misión 1: si activeId apunta a un ejercicio de capítulo y la
// página recién recargó, chapterExercises todavía puede estar vacío (se
// carga async desde Supabase) — sin este fallback, exercise.value queda
// undefined por un instante y cualquier .id/.bugs de acá abajo revienta.
// Se corrige solo apenas termina de cargar (exercise es reactivo).
const exercise = computed(() => findExercise(state.activeId) ?? EXERCISES[0]);
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

// Antes esto miraba exercise.value.code (el código ORIGINAL sin editar), así
// que apenas el alumno agregaba o borraba una línea, la numeración quedaba
// pegada al tamaño del código inicial — un editor que muestra mal sus
// propios números de línea no es "cómodo" para nada. Ahora sigue el código
// que se está editando de verdad.
const gutterLines = computed(() => code.value.split("\n").map((_, i) => i + 1).join("\n"));

const gutterRef = ref<HTMLElement | null>(null);
function syncGutterScroll(e: Event) {
  if (gutterRef.value) gutterRef.value.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
}

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

/* ---------------- "estoy trabado": deja la duda para el docente ---------------- */
const askOpen = ref(false);
const askMessage = ref("");
const asking = ref(false);
const askError = ref("");
const askSent = ref(false);
const canAsk = computed(() => isLinkedToAula.value);

async function sendHelp() {
  if (!askMessage.value.trim() || asking.value) return;
  asking.value = true;
  askError.value = "";
  try {
    await askForHelp({
      exerciseId: exercise.value.id,
      exerciseTitle: exercise.value.title,
      message: askMessage.value,
      code: code.value
    });
    askSent.value = true;
    askMessage.value = "";
    setTimeout(() => {
      askOpen.value = false;
      askSent.value = false;
    }, 2200);
  } catch (e: any) {
    askError.value = e?.message ?? "No se pudo enviar la consulta.";
  } finally {
    asking.value = false;
  }
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
        <div ref="gutterRef" class="gutter">{{ gutterLines }}</div>
        <textarea v-model="code" class="code-input" spellcheck="false" @scroll="syncGutterScroll" />
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
        <button v-if="canAsk" class="btn ghost help" @click="askOpen = !askOpen">🙋 ESTOY TRABADO</button>
      </div>

      <div v-if="askOpen" class="ask-box">
        <p v-if="askSent" class="ask-sent">✔ Listo, tu docente va a ver tu consulta con el código que escribiste.</p>
        <template v-else>
          <label class="ask-label">Contale a tu docente qué no te sale (se manda junto con tu código actual)</label>
          <textarea
            v-model="askMessage"
            class="ask-input"
            rows="3"
            maxlength="1000"
            placeholder="Ej: no entiendo por qué me da 0 el promedio…"
          />
          <div v-if="askError" class="ask-error">{{ askError }}</div>
          <button class="btn small" :disabled="!askMessage.trim() || asking" @click="sendHelp">
            {{ asking ? "Enviando…" : "Enviar consulta" }}
          </button>
        </template>
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
  font-size: 0.92rem;
}
.gutter {
  padding: 0.85rem 0.6rem;
  text-align: right;
  color: #4a3d5e;
  user-select: none;
  background: #08060c;
  white-space: pre;
  line-height: 1.6;
  /* Mismo alto que .code-input a propósito: en un flex row, un item con
     height explícito (el textarea) gana contra align-items:stretch y se
     queda en ese alto, pero el gutter (sin height propio) se estira para
     igualar el alto NATURAL de su contenido en vez del alto real del
     textarea — quedaban desincronizados apenas el código no entraba en una
     pantalla. Poniéndole el mismo height explícito, ambos overflowean
     "de verdad" y el scroll-sync (@scroll en el textarea) tiene sentido. */
  height: 60vh;
  min-height: 420px;
  max-height: 80vh;
  overflow-y: hidden;
}
.code-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--cream);
  padding: 0.85rem 0.9rem;
  line-height: 1.6;
  height: 60vh;
  min-height: 420px;
  max-height: 80vh;
  font-family: inherit;
  font-size: inherit;
  tab-size: 4;
}
@media (max-width: 640px) {
  .gutter,
  .code-input {
    height: 46vh;
    min-height: 300px;
  }
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
.btn.help {
  color: var(--cyan);
  outline-color: var(--cyan);
}
.btn.small {
  font-size: 0.6rem;
  padding: 0.5rem 0.8rem;
  margin-top: 0.5rem;
}
.ask-box {
  margin-top: 0.8rem;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--cyan);
  outline-offset: -2px;
  padding: 0.8rem 0.9rem;
}
.ask-label {
  display: block;
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.95rem;
  margin-bottom: 0.35rem;
}
.ask-input {
  width: 100%;
  background: #14101c;
  border: 1px solid var(--border-dark);
  color: var(--cream);
  font-family: "VT323", monospace;
  font-size: 1.02rem;
  padding: 0.45rem 0.55rem;
  resize: vertical;
  box-sizing: border-box;
}
.ask-error {
  font-family: "VT323", monospace;
  color: var(--magenta);
  font-size: 0.92rem;
  margin-top: 0.35rem;
}
.ask-sent {
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 1.02rem;
  margin: 0;
}
</style>
