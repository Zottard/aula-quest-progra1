<script setup lang="ts">
import { useSupabase } from "~/composables/useSupabase";
import { EXERCISES, type Exercise } from "~/data/exercises";
import type { StudentRow } from "~/composables/useGameState";
import { listChaptersForAula, mapRowToExercises } from "~/composables/useChapters";

definePageMeta({ middleware: "admin-auth" });

interface Aula {
  id: string;
  name: string;
  join_code: string;
  archived: boolean;
  created_at: string;
}

interface StudentOverview {
  id: string;
  aula_id: string;
  real_name: string;
  username: string;
  character_name: string;
  xp: number;
  level: number;
  quests_done: number;
  last_seen_at: string;
  created_at: string;
}

const route = useRoute();
const aulaId = route.params.id as string;
const supabase = useSupabase();

const aula = ref<Aula | null>(null);
const students = ref<StudentOverview[]>([]);
const loading = ref(true);
const notFound = ref(false);
const errorMsg = ref("");

// Capítulos publicados de esta aula, para poder mostrar el desglose de un
// alumno completo (misiones fijas + capítulos) — antes el detalle expandido
// solo recorría EXERCISES (las 7 misiones fijas) y un capítulo aprobado
// desaparecía sin dejar rastro en el panel del docente.
const chapterExercises = ref<Exercise[]>([]);

const expandedId = ref<string | null>(null);
const detailCache = ref<Record<string, StudentRow>>({});
const detailLoading = ref<Record<string, boolean>>({});
const detailError = ref<Record<string, string>>({});

const deletingId = ref<string | null>(null);
const copiedCode = ref(false);

const TOTAL_MISIONES = EXERCISES.length;

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

async function loadAll() {
  loading.value = true;
  errorMsg.value = "";
  notFound.value = false;

  const { data: aulaData, error: aulaErr } = await supabase.from("aulas").select("*").eq("id", aulaId).maybeSingle();
  if (aulaErr) {
    errorMsg.value = aulaErr.message;
    loading.value = false;
    return;
  }
  if (!aulaData) {
    notFound.value = true;
    loading.value = false;
    return;
  }
  aula.value = aulaData as Aula;

  const { data: studentsData, error: studentsErr } = await supabase
    .from("students_overview")
    .select("*")
    .eq("aula_id", aulaId)
    .order("real_name", { ascending: true });
  if (studentsErr) {
    errorMsg.value = studentsErr.message;
    loading.value = false;
    return;
  }
  students.value = (studentsData as StudentOverview[]) ?? [];

  try {
    const rows = await listChaptersForAula(aulaId);
    chapterExercises.value = rows.filter((r) => r.status === "published").flatMap(mapRowToExercises);
  } catch (e: any) {
    // No bloqueamos el roster si esto falla — el desglose de capítulos
    // simplemente queda vacío, el resto de la página sigue andando.
    console.warn("[admin] no se pudieron cargar los capítulos de la aula:", e?.message);
  }

  loading.value = false;
}

async function toggleExpand(id: string) {
  if (expandedId.value === id) {
    expandedId.value = null;
    return;
  }
  expandedId.value = id;
  if (detailCache.value[id]) return;

  detailLoading.value[id] = true;
  detailError.value[id] = "";
  const { data, error } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  detailLoading.value[id] = false;
  if (error) {
    detailError.value[id] = error.message;
    return;
  }
  if (data) detailCache.value[id] = data as StudentRow;
}

function exerciseStatus(detail: StudentRow, exerciseId: string) {
  const es = detail.game_state?.exercises?.[exerciseId];
  return {
    completed: !!es?.completed,
    solved: es?.solved ?? {},
    hinted: es?.hinted ?? {}
  };
}

function chaptersCompletedCount(detail: StudentRow): number {
  return chapterExercises.value.filter((ex) => exerciseStatus(detail, ex.id).completed).length;
}

async function deleteStudent(s: StudentOverview) {
  if (deletingId.value) return;
  const ok = confirm(`¿Borrar a ${s.real_name} (${s.username})? Esto elimina todo su progreso y no se puede deshacer.`);
  if (!ok) return;
  deletingId.value = s.id;
  const { error } = await supabase.from("students").delete().eq("id", s.id);
  deletingId.value = null;
  if (error) {
    errorMsg.value = error.message;
    return;
  }
  students.value = students.value.filter((x) => x.id !== s.id);
  delete detailCache.value[s.id];
  if (expandedId.value === s.id) expandedId.value = null;
}

async function copyCode() {
  if (!aula.value) return;
  try {
    await navigator.clipboard.writeText(aula.value.join_code);
    copiedCode.value = true;
    setTimeout(() => (copiedCode.value = false), 1500);
  } catch {
    // no crítico
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="admin-page">
    <NuxtLink to="/admin" class="back-link">← Mis aulas</NuxtLink>

    <div v-if="loading" class="loading">Cargando…</div>

    <div v-else-if="notFound" class="empty">
      Esta aula no existe o no te pertenece.
    </div>

    <template v-else>
      <header class="admin-header">
        <div>
          <div class="eyebrow">// c++ quest — panel docente</div>
          <h1>{{ aula?.name }}</h1>
        </div>
        <div class="header-actions">
          <NuxtLink :to="`/admin/aulas/${aulaId}/capitulos`" class="btn ghost">📘 Capítulos</NuxtLink>
          <div class="join-code-row" @click="copyCode">
            <span class="join-code-label">código:</span>
            <span class="join-code">{{ aula?.join_code }}</span>
            <span class="copy-hint">{{ copiedCode ? "¡copiado!" : "copiar" }}</span>
          </div>
        </div>
      </header>

      <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>

      <p v-if="students.length === 0" class="empty">
        Todavía no hay alumnos anotados. Compartí el código de aula para que se registren.
      </p>

      <div v-else class="students-table pxframe">
        <div class="row row-head">
          <span>Alumno</span>
          <span>Usuario</span>
          <span>Personaje</span>
          <span>Nivel</span>
          <span>XP</span>
          <span>Misiones</span>
          <span>Última vez</span>
          <span></span>
        </div>

        <template v-for="s in students" :key="s.id">
          <div class="row" :class="{ expanded: expandedId === s.id }" @click="toggleExpand(s.id)">
            <span class="cell-name">{{ s.real_name }}</span>
            <span class="cell-dim">{{ s.username }}</span>
            <span class="cell-dim">{{ s.character_name }}</span>
            <span class="cell-amber">{{ s.level }}</span>
            <span class="cell-dim">{{ s.xp }}</span>
            <span class="cell-dim">{{ s.quests_done }}/{{ TOTAL_MISIONES }}</span>
            <span class="cell-dim small">{{ formatDate(s.last_seen_at) }}</span>
            <span class="cell-actions">
              <button
                class="btn ghost tiny"
                :disabled="deletingId === s.id"
                @click.stop="deleteStudent(s)"
              >
                {{ deletingId === s.id ? "…" : "✕" }}
              </button>
            </span>
          </div>

          <div v-if="expandedId === s.id" class="detail-panel">
            <p v-if="detailLoading[s.id]" class="loading">Cargando detalle…</p>
            <p v-else-if="detailError[s.id]" class="error-box">{{ detailError[s.id] }}</p>
            <div v-else-if="detailCache[s.id]" class="exercise-list">
              <div v-for="ex in EXERCISES" :key="ex.id" class="exercise-item">
                <div class="exercise-head">
                  <span class="exercise-status" :class="{ done: exerciseStatus(detailCache[s.id], ex.id).completed }">
                    {{ exerciseStatus(detailCache[s.id], ex.id).completed ? "✔" : "○" }}
                  </span>
                  <span class="exercise-title">{{ ex.title }}</span>
                </div>
                <div class="bug-list">
                  <span
                    v-for="bug in ex.bugs"
                    :key="bug.id"
                    class="bug-chip"
                    :class="{
                      solved: exerciseStatus(detailCache[s.id], ex.id).solved[bug.id],
                      hinted: exerciseStatus(detailCache[s.id], ex.id).hinted[bug.id]
                    }"
                  >
                    {{ bug.label }}
                    <template v-if="exerciseStatus(detailCache[s.id], ex.id).hinted[bug.id]"> (con pista)</template>
                  </span>
                </div>
              </div>

              <template v-if="chapterExercises.length > 0">
                <div class="chapters-heading">
                  📘 Capítulos — {{ chaptersCompletedCount(detailCache[s.id]) }}/{{ chapterExercises.length }} completados
                </div>
                <div v-for="ex in chapterExercises" :key="ex.id" class="exercise-item">
                  <div class="exercise-head">
                    <span class="exercise-status" :class="{ done: exerciseStatus(detailCache[s.id], ex.id).completed }">
                      {{ exerciseStatus(detailCache[s.id], ex.id).completed ? "✔" : "○" }}
                    </span>
                    <span class="exercise-title">{{ ex.title }}</span>
                    <span class="exercise-chapter-tag">{{ ex.chapterTitle }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 1100px;
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
  align-items: flex-end;
  margin-bottom: 1.4rem;
  flex-wrap: wrap;
  gap: 0.8rem;
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
  margin: 0.5rem 0 0;
  text-shadow: 2px 2px 0 var(--border-dark);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
}
.join-code-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #0a0810;
  border: 2px dashed var(--border-light);
  padding: 0.4rem 0.7rem;
  cursor: pointer;
}
.join-code-label {
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.9rem;
}
.join-code {
  font-family: "VT323", monospace;
  font-size: 1.2rem;
  letter-spacing: 0.15em;
  color: var(--cyan);
}
.copy-hint {
  font-family: "VT323", monospace;
  font-size: 0.85rem;
  color: var(--cream-dim);
}
.error-box {
  background: rgba(255, 63, 164, 0.12);
  border: 2px solid var(--magenta);
  color: var(--magenta);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  padding: 0.5rem 0.6rem;
  margin-bottom: 1rem;
}
.loading,
.empty {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 1.1rem;
}
.students-table {
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 0.4rem 0.6rem;
}
.row {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr 0.6fr 0.7fr 0.9fr 1fr 0.5fr;
  gap: 0.6rem;
  align-items: center;
  padding: 0.55rem 0.5rem;
  border-bottom: 1px solid var(--border-dark);
  font-family: "VT323", monospace;
  font-size: 1rem;
  cursor: pointer;
}
.row:hover {
  background: rgba(255, 255, 255, 0.03);
}
.row-head {
  font-family: "Press Start 2P", monospace;
  font-size: 0.55rem;
  color: var(--cream-dim);
  cursor: default;
  text-transform: uppercase;
}
.row-head:hover {
  background: none;
}
.row.expanded {
  border-bottom: none;
  background: rgba(255, 176, 0, 0.06);
}
.cell-name {
  color: var(--cream);
  font-weight: 700;
}
.cell-dim {
  color: var(--cream-dim);
}
.cell-amber {
  color: var(--amber);
}
.cell-dim.small {
  font-size: 0.9rem;
}
.cell-actions {
  text-align: right;
}
.btn {
  font-family: "Press Start 2P", monospace;
  font-size: 0.65rem;
  padding: 0.45rem 0.7rem;
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
.btn.ghost {
  background: var(--bg-panel);
  color: var(--magenta);
  outline-color: var(--magenta);
}
.btn.tiny {
  font-size: 0.6rem;
  padding: 0.3rem 0.5rem;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.detail-panel {
  padding: 0.8rem 1rem 1.2rem;
  border-bottom: 1px solid var(--border-dark);
  background: rgba(0, 0, 0, 0.15);
}
.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.exercise-item {
  border: 1px solid var(--border-dark);
  padding: 0.5rem 0.7rem;
}
.chapters-heading {
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 1rem;
  margin: 1rem 0 0.5rem;
  padding-top: 0.7rem;
  border-top: 1px dashed var(--border-dark);
}
.exercise-chapter-tag {
  margin-left: auto;
  font-family: "VT323", monospace;
  font-size: 0.8rem;
  color: var(--cream-dim);
  opacity: 0.7;
}
.exercise-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.exercise-status {
  font-family: monospace;
  font-size: 1.1rem;
  color: var(--cream-dim);
  width: 1.2rem;
  text-align: center;
}
.exercise-status.done {
  color: var(--cyan);
}
.exercise-title {
  font-family: "VT323", monospace;
  font-size: 1.05rem;
  color: var(--cream);
}
.bug-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.bug-chip {
  font-family: "VT323", monospace;
  font-size: 0.85rem;
  color: var(--cream-dim);
  border: 1px solid var(--border-light);
  padding: 0.15rem 0.5rem;
  opacity: 0.6;
}
.bug-chip.solved {
  color: var(--cyan);
  border-color: var(--cyan);
  opacity: 1;
}
.bug-chip.hinted {
  color: var(--amber);
  border-color: var(--amber);
}
@media (max-width: 720px) {
  .row {
    grid-template-columns: 1fr 1fr 0.6fr 0.5fr;
  }
  .row span:nth-child(3),
  .row span:nth-child(7) {
    display: none;
  }
}
</style>
