<script setup lang="ts">
import { useTeacherAuth } from "~/composables/useTeacherAuth";
import { extractPdfText } from "~/composables/usePdfExtract";
import { MODULES } from "~/data/modules";
import type { Topic } from "~/data/modules";
import {
  generateChapterFromText,
  listChaptersForAula,
  publishChapter,
  setChapterStatus,
  deleteChapter,
  type GeneratedExercise
} from "~/composables/useChapters";

const BATTLE_TOPICS = MODULES.filter((m) => m.id !== "capitulo");

definePageMeta({ middleware: "admin-auth" });

interface ReviewExercise extends GeneratedExercise {
  selected: boolean;
}

interface ChapterRow {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  generated_exercises: GeneratedExercise[];
  created_at: string;
}

const route = useRoute();
const aulaId = route.params.id as string;
const { currentTeacher } = useTeacherAuth();

const chapters = ref<ChapterRow[]>([]);
const loadingChapters = ref(true);
const listError = ref("");

const fileInputRef = ref<HTMLInputElement | null>(null);
const fileName = ref("");
const extractedText = ref("");
const extracting = ref(false);
const extractError = ref("");

const generating = ref(false);
const genError = ref("");
const reviewExercises = ref<ReviewExercise[] | null>(null);
const truncatedWarning = ref(false);
const cappedWarning = ref(false);

const chapterTitle = ref("");
const publishing = ref(false);
const publishError = ref("");

async function loadChapters() {
  loadingChapters.value = true;
  listError.value = "";
  try {
    chapters.value = (await listChaptersForAula(aulaId)) as ChapterRow[];
  } catch (e: any) {
    listError.value = e?.message ?? "No se pudieron cargar los capítulos.";
  } finally {
    loadingChapters.value = false;
  }
}

async function handleFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  reviewExercises.value = null;
  genError.value = "";
  extractError.value = "";
  fileName.value = file.name;
  chapterTitle.value = file.name.replace(/\.pdf$/i, "");

  extracting.value = true;
  try {
    extractedText.value = await extractPdfText(file);
  } catch (e: any) {
    extractError.value = e?.message ?? "No se pudo leer el PDF. ¿Es un PDF de texto (no escaneado)?";
    extractedText.value = "";
  } finally {
    extracting.value = false;
  }
}

async function handleGenerate() {
  if (!extractedText.value.trim() || generating.value) return;
  generating.value = true;
  genError.value = "";
  reviewExercises.value = null;
  try {
    const { exercises, truncated, capped } = await generateChapterFromText(extractedText.value);
    truncatedWarning.value = truncated;
    cappedWarning.value = capped;
    reviewExercises.value = exercises.map((ex) => ({ ...ex, selected: true }));
    if (exercises.length === 0) {
      genError.value = "La IA no encontró ningún ejercicio en este texto.";
    }
  } catch (e: any) {
    genError.value = e?.message ?? "Falló la generación.";
  } finally {
    generating.value = false;
  }
}

const selectedCount = computed(() => reviewExercises.value?.filter((e) => e.selected).length ?? 0);

// Los casos "computed" los inventó la IA (el enunciado no traía ejemplo) —
// expectedValues se edita como texto plano separado por comas y se
// re-parsea, para que el docente pueda corregir la cuenta a mano antes de
// publicar sin tener que tocar un array a mano. stdin se edita directo
// con v-model (ya es texto plano, una línea por valor de entrada).
function expectedValuesText(tc: GeneratedExercise["testCases"][number]): string {
  return tc.expectedValues.join(", ");
}
function setExpectedValuesText(tc: GeneratedExercise["testCases"][number], value: string) {
  tc.expectedValues = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

async function handlePublish() {
  if (!reviewExercises.value || selectedCount.value === 0 || publishing.value) return;
  const teacher = await currentTeacher();
  if (!teacher) {
    publishError.value = "No se pudo confirmar tu sesión docente.";
    return;
  }
  publishing.value = true;
  publishError.value = "";
  try {
    const toPublish = reviewExercises.value.filter((e) => e.selected).map(({ selected, ...rest }) => rest);
    await publishChapter({
      aulaId,
      teacherId: teacher.id,
      title: chapterTitle.value.trim() || "Capítulo sin título",
      sourcePdfName: fileName.value || undefined,
      exercises: toPublish
    });
    // reset del flujo de carga
    reviewExercises.value = null;
    extractedText.value = "";
    fileName.value = "";
    chapterTitle.value = "";
    if (fileInputRef.value) fileInputRef.value.value = "";
    await loadChapters();
  } catch (e: any) {
    publishError.value = e?.message ?? "No se pudo publicar el capítulo.";
  } finally {
    publishing.value = false;
  }
}

async function toggleStatus(ch: ChapterRow) {
  const next = ch.status === "published" ? "archived" : "published";
  try {
    await setChapterStatus(ch.id, next);
    ch.status = next;
  } catch (e: any) {
    listError.value = e?.message ?? "No se pudo actualizar el estado.";
  }
}

async function handleDelete(ch: ChapterRow) {
  if (!confirm(`¿Borrar el capítulo "${ch.title}"? Esto no se puede deshacer.`)) return;
  try {
    await deleteChapter(ch.id);
    chapters.value = chapters.value.filter((c) => c.id !== ch.id);
  } catch (e: any) {
    listError.value = e?.message ?? "No se pudo borrar.";
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

onMounted(loadChapters);
</script>

<template>
  <div class="admin-page">
    <NuxtLink :to="`/admin/aulas/${aulaId}`" class="back-link">← Volver al aula</NuxtLink>

    <header class="admin-header">
      <div class="eyebrow">// c++ quest — panel docente</div>
      <h1>Capítulos</h1>
      <p class="sub">
        Subí un PDF de ejercicios (con ejemplos ya resueltos) y una IA arma un capítulo jugable a partir de esos
        ejemplos — no inventa casos nuevos, extrae los que ya escribiste en la guía.
      </p>
    </header>

    <section class="upload-box pxframe">
      <label class="field">
        <span>1. Elegí el PDF</span>
        <input ref="fileInputRef" type="file" accept="application/pdf" @change="handleFilePicked" />
      </label>

      <p v-if="extracting" class="hint">Leyendo el PDF…</p>
      <p v-if="extractError" class="error-box">{{ extractError }}</p>

      <template v-if="extractedText && !extracting">
        <details class="preview">
          <summary>Texto extraído ({{ extractedText.length }} caracteres) — click para ver</summary>
          <pre>{{ extractedText }}</pre>
        </details>

        <button class="btn" :disabled="generating" @click="handleGenerate">
          {{ generating ? "⏳ Generando con IA…" : "2. ✨ Generar con IA" }}
        </button>
      </template>

      <p v-if="genError" class="error-box">{{ genError }}</p>
      <p v-if="truncatedWarning" class="hint warn">
        ⚠ El PDF es largo, se procesaron solo los primeros ~15.000 caracteres.
      </p>
      <p v-if="cappedWarning" class="hint warn">
        ⚠ La guía trae más de 10 ejercicios — se generaron solo los primeros 10. Subí el
        resto en un capítulo aparte si querés incluirlos.
      </p>
    </section>

    <section v-if="reviewExercises && reviewExercises.length > 0" class="review-box pxframe">
      <h2>3. Revisá y publicá</h2>
      <p class="hint">
        Desmarcá los que no quieras incluir. Podés editar título, consigna, tipo de batalla y casos de prueba antes
        de publicar — prestá especial atención a los marcados ⚠, esos los calculó la IA porque el enunciado no
        traía ejemplo. El tipo (Operadores/Ciclos/Vectores) decide qué arma le da bono de XP al alumno en ese
        ejercicio, igual que en las 7 misiones — la IA lo asigna, pero podés corregirlo si no te cierra.
      </p>

      <div v-for="(ex, i) in reviewExercises" :key="i" class="review-item" :class="{ off: !ex.selected }">
        <div class="review-item-head">
          <label class="checkbox-label">
            <input v-model="ex.selected" type="checkbox" />
            <input v-model="ex.title" type="text" class="title-input" />
          </label>
          <select v-model="ex.topic" class="topic-select" :style="{ color: (MODULES.find((m) => m.id === ex.topic) ?? MODULES[0]).color }">
            <option v-for="m in BATTLE_TOPICS" :key="m.id" :value="m.id">{{ m.short }}</option>
          </select>
          <span class="case-count">{{ ex.testCases.length }} caso{{ ex.testCases.length > 1 ? "s" : "" }}</span>
        </div>
        <textarea v-model="ex.briefing" class="briefing-input" rows="2" />
        <div class="cases">
          <div v-for="(tc, j) in ex.testCases" :key="j" class="case-row" :class="{ computed: tc.computed }">
            <div v-if="tc.computed" class="computed-warn">
              ⚠ Este caso lo calculó la IA (el enunciado no traía ejemplo) — revisá la cuenta antes de publicar.
            </div>
            <div class="case-fields">
              <label class="case-field">
                <span>stdin (un valor por línea)</span>
                <textarea v-model="tc.stdin" class="case-input" rows="2" />
              </label>
              <label class="case-field">
                <span>resultado esperado (separado por comas)</span>
                <input
                  type="text"
                  class="case-input"
                  :value="expectedValuesText(tc)"
                  @input="setExpectedValuesText(tc, ($event.target as HTMLInputElement).value)"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <label class="field">
        <span>Título del capítulo</span>
        <input v-model="chapterTitle" type="text" maxlength="80" placeholder="Ej: Guía de ejercicios N°1" />
      </label>

      <div v-if="publishError" class="error-box">{{ publishError }}</div>

      <button class="btn" :disabled="selectedCount === 0 || publishing" @click="handlePublish">
        {{ publishing ? "Publicando…" : `Publicar ${selectedCount} ejercicio(s) en esta aula` }}
      </button>
    </section>

    <section class="list-box">
      <h2>Capítulos de esta aula</h2>
      <div v-if="listError" class="error-box">{{ listError }}</div>
      <p v-if="loadingChapters" class="hint">Cargando…</p>
      <p v-else-if="chapters.length === 0" class="hint">Todavía no hay capítulos.</p>

      <div v-else class="chapters-grid">
        <div v-for="ch in chapters" :key="ch.id" class="chapter-card pxframe" :class="ch.status">
          <div class="chapter-title">{{ ch.title }}</div>
          <div class="chapter-meta">
            {{ ch.generated_exercises?.length ?? 0 }} ejercicio(s) · {{ formatDate(ch.created_at) }}
          </div>
          <div class="chapter-status">{{ ch.status }}</div>
          <div class="chapter-actions">
            <button class="btn ghost small" @click="toggleStatus(ch)">
              {{ ch.status === "published" ? "Archivar" : "Publicar" }}
            </button>
            <button class="btn ghost small danger" @click="handleDelete(ch)">Borrar</button>
          </div>
        </div>
      </div>
    </section>
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
  font-size: 0.85rem;
  margin: 0 0 0.8rem;
}
.sub {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 1rem;
  line-height: 1.4;
  max-width: 620px;
}
.upload-box,
.review-box {
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 1.2rem 1.4rem;
  margin-bottom: 1.4rem;
}
.field {
  display: block;
  margin-bottom: 0.9rem;
}
.field span {
  display: block;
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.9rem;
  margin-bottom: 0.3rem;
}
.field input[type="text"] {
  width: 100%;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  color: var(--cream);
  font-family: "VT323", monospace;
  font-size: 1.05rem;
  padding: 0.5rem 0.6rem;
}
input[type="file"] {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
}
.hint {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
}
.hint.warn {
  color: var(--amber);
}
.preview {
  margin: 0.8rem 0;
  border: 1px solid var(--border-light);
  padding: 0.5rem 0.7rem;
}
.preview summary {
  cursor: pointer;
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 0.95rem;
}
.preview pre {
  white-space: pre-wrap;
  font-family: "JetBrains Mono", monospace;
  font-size: 0.75rem;
  color: var(--cream-dim);
  max-height: 220px;
  overflow-y: auto;
  margin-top: 0.6rem;
}
.error-box {
  background: rgba(255, 63, 164, 0.12);
  border: 2px solid var(--magenta);
  color: var(--magenta);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  padding: 0.5rem 0.6rem;
  margin: 0.6rem 0;
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
  text-decoration: none;
  display: inline-block;
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn.ghost {
  background: var(--bg-panel);
  color: var(--cream-dim);
  outline-color: var(--border-light);
}
.btn.ghost.danger {
  color: var(--magenta);
  outline-color: var(--magenta);
}
.btn.small {
  font-size: 0.58rem;
  padding: 0.4rem 0.6rem;
}
.review-item {
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  padding: 0.7rem 0.8rem;
  margin-bottom: 0.8rem;
}
.review-item.off {
  opacity: 0.4;
}
.review-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.4rem;
}
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}
.title-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px dashed var(--border-light);
  color: var(--amber);
  font-family: "VT323", monospace;
  font-size: 1.1rem;
  padding: 0.2rem;
}
.case-count {
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.85rem;
  white-space: nowrap;
}
.topic-select {
  background: #0a0810;
  border: 1px solid var(--border-light);
  font-family: "VT323", monospace;
  font-size: 0.9rem;
  padding: 0.2rem 0.4rem;
  flex: none;
}
.briefing-input {
  width: 100%;
  background: #0a0810;
  border: 1px solid var(--border-dark);
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  padding: 0.4rem 0.5rem;
  resize: vertical;
  margin-bottom: 0.5rem;
}
.cases {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.case-row {
  background: #0a0810;
  padding: 0.5rem 0.6rem;
  border: 1px dashed var(--border-light);
}
.case-row.computed {
  border-color: var(--amber);
  border-style: solid;
}
.computed-warn {
  font-family: "VT323", monospace;
  font-size: 0.85rem;
  color: var(--amber);
  margin-bottom: 0.4rem;
}
.case-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.case-field {
  flex: 1;
  min-width: 180px;
  display: block;
}
.case-field span {
  display: block;
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.8rem;
  margin-bottom: 0.2rem;
}
.case-input {
  width: 100%;
  background: #14101c;
  border: 1px solid var(--border-dark);
  color: var(--cyan);
  font-family: "JetBrains Mono", monospace;
  font-size: 0.78rem;
  padding: 0.35rem 0.5rem;
  resize: vertical;
  box-sizing: border-box;
}
.list-box {
  margin-top: 1.6rem;
}
.chapters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
.chapter-card {
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 0.9rem 1rem;
}
.chapter-card.archived {
  opacity: 0.55;
}
.chapter-title {
  font-family: "VT323", monospace;
  font-size: 1.15rem;
  color: var(--amber);
  margin-bottom: 0.3rem;
}
.chapter-meta {
  font-family: "VT323", monospace;
  font-size: 0.85rem;
  color: var(--cream-dim);
  margin-bottom: 0.3rem;
}
.chapter-status {
  display: inline-block;
  font-family: "VT323", monospace;
  font-size: 0.8rem;
  color: var(--cyan);
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}
.chapter-actions {
  display: flex;
  gap: 0.4rem;
}
</style>
