<script setup lang="ts">
import {
  fetchClassInsights,
  FAIL_REASON_LABEL,
  FAIL_REASON_HINT,
  type ClassInsights
} from "~/composables/useClassInsights";
import type { FailReason } from "~/composables/useProgressSync";
import { listQuestionsForAula, resolveQuestion } from "~/composables/useStudentQuestions";

definePageMeta({ middleware: "admin-auth" });

const route = useRoute();
const aulaId = route.params.id as string;

const insights = ref<ClassInsights | null>(null);
const loading = ref(true);
const errorMsg = ref("");

const questions = ref<any[]>([]);
const openQuestionCode = ref<Record<number, boolean>>({});

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const [ins, qs] = await Promise.all([
      fetchClassInsights(aulaId),
      listQuestionsForAula(aulaId, "open").catch(() => [])
    ]);
    insights.value = ins;
    questions.value = qs;
  } catch (e: any) {
    errorMsg.value = e?.message ?? "No se pudieron cargar los datos de la clase.";
  } finally {
    loading.value = false;
  }
}

async function markResolved(id: number) {
  try {
    await resolveQuestion(id);
    questions.value = questions.value.filter((q) => q.id !== id);
  } catch (e: any) {
    errorMsg.value = e?.message ?? "No se pudo marcar como resuelta.";
  }
}

/** Solo mostramos ejercicios donde realmente hay gente trabada — un ejercicio
 * que todos resolvieron a la primera no aporta nada a la decisión de qué
 * explicar en clase. */
const topTroubles = computed(() => (insights.value?.troubles ?? []).filter((t) => t.studentsStuck > 0).slice(0, 8));

const reasonBars = computed(() => {
  const totals = insights.value?.reasonTotals ?? {};
  const sum = Object.values(totals).reduce((a, b) => a + (b ?? 0), 0);
  if (!sum) return [];
  return (Object.entries(totals) as [FailReason, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => ({ reason, n, pct: Math.round((n / sum) * 100) }));
});

function daysAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  return `hace ${d} días`;
}

onMounted(load);
</script>

<template>
  <div class="admin-page">
    <NuxtLink :to="`/admin/aulas/${aulaId}`" class="back-link">← Volver al aula</NuxtLink>

    <header class="admin-header">
      <div>
        <div class="eyebrow">// c++ quest — panel docente</div>
        <h1>Antes de la clase</h1>
        <p class="sub">
          Dónde se está trabando la clase, según los intentos reales contra el compilador. Pensado para mirar un rato
          antes de entrar al aula y decidir qué explicar.
        </p>
      </div>
      <button class="btn ghost" :disabled="loading" @click="load">
        {{ loading ? "…" : "↻ Actualizar" }}
      </button>
    </header>

    <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>
    <p v-if="loading" class="hint">Cargando…</p>

    <template v-else-if="insights">
      <section class="stat-row">
        <div class="stat pxframe">
          <span class="n">{{ insights.totalStudents }}</span><span class="l">alumnos</span>
        </div>
        <div class="stat pxframe">
          <span class="n cyan">{{ insights.activeStudents }}</span><span class="l">activos (7 días)</span>
        </div>
        <div class="stat pxframe">
          <span class="n" :class="insights.neverStarted.length ? 'magenta' : ''">{{ insights.neverStarted.length }}</span>
          <span class="l">sin arrancar</span>
        </div>
      </section>

      <section v-if="questions.length" class="panel pxframe">
        <h2>🙋 Dudas sin responder ({{ questions.length }})</h2>
        <p class="hint">Lo que dejaron trabados durante el trabajo previo. Ideal para arrancar la clase por acá.</p>
        <div v-for="q in questions" :key="q.id" class="question">
          <div class="question-head">
            <span class="q-student">{{ q.students?.real_name ?? "alumno" }}</span>
            <span class="q-ex">{{ q.exercise_title || q.exercise_id }}</span>
            <span class="q-when">{{ daysAgo(q.created_at) }}</span>
          </div>
          <p class="q-msg">“{{ q.message }}”</p>
          <div class="q-actions">
            <button v-if="q.code_snapshot" class="mini" @click="openQuestionCode[q.id] = !openQuestionCode[q.id]">
              {{ openQuestionCode[q.id] ? "ocultar código" : "ver su código" }}
            </button>
            <button class="mini ok" @click="markResolved(q.id)">marcar resuelta</button>
          </div>
          <pre v-if="openQuestionCode[q.id]" class="q-code">{{ q.code_snapshot }}</pre>
        </div>
      </section>

      <section v-if="reasonBars.length" class="panel pxframe">
        <h2>Tipo de error dominante</h2>
        <div v-for="b in reasonBars" :key="b.reason" class="bar-row">
          <span class="bar-label">{{ FAIL_REASON_LABEL[b.reason] }}</span>
          <div class="bar-track"><div class="bar-fill" :class="b.reason" :style="{ width: b.pct + '%' }" /></div>
          <span class="bar-n">{{ b.n }}</span>
        </div>
        <p class="bar-hint">💡 {{ FAIL_REASON_HINT[reasonBars[0].reason] }}</p>
      </section>

      <section class="panel pxframe">
        <h2>🔥 ¿Dónde está trabada la clase?</h2>
        <p v-if="topTroubles.length === 0" class="hint">
          Todavía nadie se trabó en nada — o la clase aún no empezó a resolver.
        </p>
        <div v-for="t in topTroubles" :key="t.exerciseId" class="trouble">
          <div class="trouble-head">
            <span class="trouble-title">{{ t.title }}</span>
            <span v-if="t.isChapter" class="tag">capítulo</span>
          </div>
          <div class="trouble-meta">
            <strong class="magenta">{{ t.studentsStuck }}</strong> trabado(s) ·
            <strong>{{ t.studentsCompleted }}</strong> lo resolvieron ·
            {{ t.failedAttempts }} intento(s) fallido(s)
          </div>
          <div class="chips">
            <span v-for="(n, reason) in t.byReason" :key="reason" class="chip" :class="reason">
              {{ FAIL_REASON_LABEL[reason as FailReason] }}: {{ n }}
            </span>
          </div>
          <p v-if="t.topReason" class="trouble-hint">💡 {{ FAIL_REASON_HINT[t.topReason] }}</p>
        </div>
      </section>

      <section v-if="insights.struggling.length" class="panel pxframe">
        <h2>⚠️ Necesitan una mano</h2>
        <p class="hint">Intentaron mucho y avanzaron poco. Probablemente no van a pedir ayuda solos.</p>
        <div v-for="p in insights.struggling" :key="p.studentId" class="student-row">
          <span class="student-name">{{ p.realName }}</span>
          <span class="student-meta">
            {{ p.failedAttempts }} intento(s) fallido(s) · {{ p.completed }} completado(s) ·
            {{ daysAgo(p.lastSeenAt) }}
          </span>
        </div>
      </section>

      <section v-if="insights.neverStarted.length" class="panel pxframe">
        <h2>😴 No arrancaron</h2>
        <div class="never-list">
          <span v-for="p in insights.neverStarted" :key="p.studentId" class="never-chip">{{ p.realName }}</span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.2rem 3rem;
}
.back-link {
  display: inline-block;
  margin-bottom: 1.2rem;
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 1rem;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.4rem;
}
.eyebrow {
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 0.95rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  font-family: "Press Start 2P", monospace;
  color: var(--amber);
  font-size: 1.2rem;
  margin: 0.5rem 0 0.6rem;
  text-shadow: 2px 2px 0 var(--border-dark);
}
h2 {
  font-family: "Press Start 2P", monospace;
  color: var(--cream);
  font-size: 0.8rem;
  margin: 0 0 0.8rem;
}
.sub {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 1rem;
  line-height: 1.4;
  max-width: 560px;
  margin: 0;
}
.hint {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.98rem;
}
.error-box {
  background: rgba(255, 63, 164, 0.12);
  border: 2px solid var(--magenta);
  color: var(--magenta);
  font-family: "VT323", monospace;
  padding: 0.5rem 0.6rem;
  margin-bottom: 1rem;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.8rem;
  margin-bottom: 1.2rem;
}
.stat {
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 0.9rem 1rem;
}
.stat .n {
  display: block;
  font-family: "Press Start 2P", monospace;
  font-size: 1.3rem;
  color: var(--amber);
  margin-bottom: 0.3rem;
}
.stat .n.cyan {
  color: var(--cyan);
}
.stat .n.magenta {
  color: var(--magenta);
}
.stat .l {
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.95rem;
}
.panel {
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 1.1rem 1.2rem;
  margin-bottom: 1.2rem;
}
.bar-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.45rem;
  font-family: "VT323", monospace;
  font-size: 0.98rem;
}
.bar-label {
  color: var(--cream-dim);
  width: 190px;
  flex: none;
}
.bar-track {
  flex: 1;
  height: 12px;
  background: #0a0810;
  border: 1px solid var(--border-dark);
}
.bar-fill {
  height: 100%;
  background: var(--cream-dim);
}
.bar-fill.compile_error {
  background: var(--magenta);
}
.bar-fill.wrong_output {
  background: var(--amber);
}
.bar-fill.timeout {
  background: var(--red);
}
.bar-fill.runtime_error {
  background: var(--cyan);
}
.bar-n {
  color: var(--cream);
  width: 34px;
  text-align: right;
  flex: none;
}
.bar-hint {
  font-family: "VT323", monospace;
  color: var(--amber);
  font-size: 0.95rem;
  margin: 0.7rem 0 0;
}
.trouble {
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  padding: 0.7rem 0.8rem;
  margin-bottom: 0.7rem;
}
.trouble-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}
.trouble-title {
  font-family: "VT323", monospace;
  font-size: 1.15rem;
  color: var(--amber);
}
.tag {
  font-family: "VT323", monospace;
  font-size: 0.78rem;
  color: var(--cream-dim);
  border: 1px solid var(--border-light);
  padding: 0.05rem 0.35rem;
}
.trouble-meta {
  font-family: "VT323", monospace;
  font-size: 0.98rem;
  color: var(--cream-dim);
  margin-bottom: 0.45rem;
}
.magenta {
  color: var(--magenta);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.chip {
  font-family: "VT323", monospace;
  font-size: 0.85rem;
  padding: 0.1rem 0.45rem;
  border: 1px solid var(--border-light);
  color: var(--cream-dim);
}
.chip.compile_error {
  border-color: var(--magenta);
  color: var(--magenta);
}
.chip.wrong_output {
  border-color: var(--amber);
  color: var(--amber);
}
.chip.timeout {
  border-color: var(--red);
  color: var(--red);
}
.chip.runtime_error {
  border-color: var(--cyan);
  color: var(--cyan);
}
.trouble-hint {
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.92rem;
  margin: 0.5rem 0 0;
}
.student-row {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  flex-wrap: wrap;
  padding: 0.4rem 0;
  border-bottom: 1px dashed var(--border-dark);
  font-family: "VT323", monospace;
}
.student-row:last-child {
  border-bottom: none;
}
.student-name {
  color: var(--cream);
  font-size: 1.05rem;
}
.student-meta {
  color: var(--cream-dim);
  font-size: 0.92rem;
}
.never-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.never-chip {
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  color: var(--cream-dim);
  border: 1px dashed var(--border-light);
  padding: 0.15rem 0.5rem;
}
.question {
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--cyan);
  outline-offset: -2px;
  padding: 0.65rem 0.8rem;
  margin-bottom: 0.7rem;
}
.question-head {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  flex-wrap: wrap;
  font-family: "VT323", monospace;
  margin-bottom: 0.3rem;
}
.q-student {
  color: var(--cream);
  font-size: 1.08rem;
  font-weight: 700;
}
.q-ex {
  color: var(--amber);
  font-size: 0.92rem;
}
.q-when {
  color: var(--cream-dim);
  font-size: 0.85rem;
  margin-left: auto;
}
.q-msg {
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 1.02rem;
  margin: 0 0 0.5rem;
  line-height: 1.4;
}
.q-actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.mini {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.88rem;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
}
.mini.ok {
  border-color: var(--cyan);
  color: var(--cyan);
}
.q-code {
  margin: 0.55rem 0 0;
  padding: 0.6rem 0.75rem;
  background: #08060c;
  border: 1px solid var(--border-dark);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.76rem;
  line-height: 1.55;
  color: var(--cream);
  white-space: pre;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}
.btn {
  font-family: "Press Start 2P", monospace;
  font-size: 0.65rem;
  padding: 0.55rem 0.8rem;
  cursor: pointer;
  border: 2px solid var(--border-dark);
  outline: 2px solid var(--amber);
  outline-offset: -4px;
  background: var(--amber);
  color: #1a1509;
  font-weight: 700;
  white-space: nowrap;
}
.btn.ghost {
  background: var(--bg-panel);
  color: var(--cream-dim);
  outline-color: var(--border-light);
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
