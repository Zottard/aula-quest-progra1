<script setup lang="ts">
import { EXERCISES } from "~/data/exercises";
import { useTeacherAuth } from "~/composables/useTeacherAuth";
import {
  listOverridesForAula,
  saveOverride,
  resetOverride,
  applyPatch,
  type ExercisePatch
} from "~/composables/useExerciseOverrides";

definePageMeta({ middleware: "admin-auth" });

const route = useRoute();
const aulaId = route.params.id as string;
const { currentTeacher } = useTeacherAuth();

const patches = ref<Record<string, ExercisePatch>>({});
const loading = ref(true);
const errorMsg = ref("");
const okMsg = ref("");

const editingId = ref<string | null>(null);
/** Borrador del formulario. Se arma a partir del ejercicio YA parcheado, así
 * el docente edita sobre lo que ven sus alumnos hoy, no sobre el de fábrica. */
const draft = ref<{
  title: string;
  briefing: string;
  code: string;
  expectedOutput: string;
  bugs: { id: string; label: string; hint: string; explanation: string }[];
} | null>(null);
const saving = ref(false);

async function load() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const rows = await listOverridesForAula(aulaId);
    const map: Record<string, ExercisePatch> = {};
    for (const r of rows) map[r.exercise_id] = r.patch ?? {};
    patches.value = map;
  } catch (e: any) {
    errorMsg.value = e?.message ?? "No se pudieron cargar las misiones.";
  } finally {
    loading.value = false;
  }
}

/** La misión tal como la ve el alumno de ESTA aula. */
function effective(exId: string) {
  const base = EXERCISES.find((e) => e.id === exId)!;
  return applyPatch(base, patches.value[exId]);
}

function isCustomized(exId: string): boolean {
  return Object.keys(patches.value[exId] ?? {}).length > 0;
}

function startEdit(exId: string) {
  okMsg.value = "";
  if (editingId.value === exId) {
    editingId.value = null;
    draft.value = null;
    return;
  }
  const ex = effective(exId);
  editingId.value = exId;
  draft.value = {
    title: ex.title,
    briefing: ex.briefing,
    code: ex.code,
    expectedOutput: ex.expectedOutput ?? "",
    bugs: ex.bugs.map((b) => ({ id: b.id, label: b.label, hint: b.hint, explanation: b.explanation }))
  };
}

/** Solo mandamos lo que difiere del original: así, si mañana se corrige una
 * misión de fábrica, las aulas que no la tocaron heredan la corrección. */
function buildPatch(exId: string): ExercisePatch {
  const base = EXERCISES.find((e) => e.id === exId)!;
  const d = draft.value!;
  const patch: ExercisePatch = {};
  if (d.title !== base.title) patch.title = d.title;
  if (d.briefing !== base.briefing) patch.briefing = d.briefing;
  if (d.code !== base.code) patch.code = d.code;
  if (d.expectedOutput !== (base.expectedOutput ?? "")) patch.expectedOutput = d.expectedOutput;

  const bugs = d.bugs.filter((b) => {
    const ob = base.bugs.find((x) => x.id === b.id);
    return ob && (b.label !== ob.label || b.hint !== ob.hint || b.explanation !== ob.explanation);
  });
  if (bugs.length) patch.bugs = bugs;
  return patch;
}

async function save() {
  if (!draft.value || !editingId.value || saving.value) return;
  const teacher = await currentTeacher();
  if (!teacher) {
    errorMsg.value = "No se pudo confirmar tu sesión docente.";
    return;
  }
  saving.value = true;
  errorMsg.value = "";
  try {
    const exId = editingId.value;
    const patch = buildPatch(exId);
    if (Object.keys(patch).length === 0) {
      // Quedó igual al original: en vez de guardar un parche vacío, se borra.
      await resetOverride(aulaId, exId);
    } else {
      await saveOverride({ aulaId, teacherId: teacher.id, exerciseId: exId, patch });
    }
    editingId.value = null;
    draft.value = null;
    await load();
    okMsg.value = "Guardado. Tus alumnos lo van a ver la próxima vez que entren.";
  } catch (e: any) {
    errorMsg.value = e?.message ?? "No se pudo guardar.";
  } finally {
    saving.value = false;
  }
}

async function restore(exId: string) {
  if (!confirm("¿Volver esta misión a su versión original? Se pierden los cambios de esta aula.")) return;
  try {
    await resetOverride(aulaId, exId);
    if (editingId.value === exId) {
      editingId.value = null;
      draft.value = null;
    }
    await load();
    okMsg.value = "Misión restaurada a la versión original.";
  } catch (e: any) {
    errorMsg.value = e?.message ?? "No se pudo restaurar.";
  }
}

onMounted(load);
</script>

<template>
  <div class="admin-page">
    <NuxtLink :to="`/admin/aulas/${aulaId}`" class="back-link">← Volver al aula</NuxtLink>

    <header class="admin-header">
      <div class="eyebrow">// c++ quest — panel docente</div>
      <h1>Misiones base</h1>
      <p class="sub">
        Las 7 misiones que trae el juego. Podés adaptar el enunciado, el código inicial y —importante— el
        <strong>resultado esperado</strong> con el que se corrige. Los cambios valen <strong>solo para esta aula</strong>:
        las otras comisiones siguen viendo la versión original.
      </p>
    </header>

    <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>
    <div v-if="okMsg" class="info-box">{{ okMsg }}</div>
    <p v-if="loading" class="hint">Cargando…</p>

    <template v-else>
      <div v-for="ex in EXERCISES" :key="ex.id" class="mission pxframe">
        <div class="mission-head">
          <span class="mission-title">{{ effective(ex.id).title }}</span>
          <span v-if="isCustomized(ex.id)" class="tag custom">editada</span>
          <span class="mission-actions">
            <button class="btn ghost small" @click="startEdit(ex.id)">
              {{ editingId === ex.id ? "Cerrar" : "Editar" }}
            </button>
            <button v-if="isCustomized(ex.id)" class="btn ghost small danger" @click="restore(ex.id)">
              Restaurar
            </button>
          </span>
        </div>

        <div v-if="editingId === ex.id && draft" class="editor">
          <label class="field">
            <span>Título</span>
            <input v-model="draft.title" type="text" maxlength="90" />
          </label>

          <label class="field">
            <span>Enunciado (HTML simple: &lt;p&gt;, &lt;code&gt;, &lt;strong&gt;)</span>
            <textarea v-model="draft.briefing" rows="5" />
          </label>

          <label class="field">
            <span>Código inicial que ve el alumno</span>
            <textarea v-model="draft.code" rows="10" class="mono" />
          </label>

          <label class="field">
            <span>Resultado esperado — con esto se corrige, tiene que coincidir exacto</span>
            <textarea v-model="draft.expectedOutput" rows="4" class="mono" />
          </label>
          <p class="hint tiny warn">
            ⚠ Si cambiás el código inicial o el enunciado, revisá que este resultado siga siendo el que produce la
            solución correcta. Es la única fuente de verdad de la corrección.
          </p>

          <h3 class="bugs-heading">Bugs de la misión</h3>
          <p class="hint tiny">
            Podés reescribir cómo se describen. El XP y la detección no se tocan desde acá.
          </p>
          <div v-for="bug in draft.bugs" :key="bug.id" class="bug-edit">
            <label class="field">
              <span>Título del bug</span>
              <input v-model="bug.label" type="text" />
            </label>
            <label class="field">
              <span>Pista</span>
              <textarea v-model="bug.hint" rows="2" />
            </label>
            <label class="field">
              <span>Explicación (se muestra al resolverlo)</span>
              <textarea v-model="bug.explanation" rows="2" />
            </label>
          </div>

          <button class="btn" :disabled="saving" @click="save">
            {{ saving ? "Guardando…" : "Guardar para esta aula" }}
          </button>
        </div>
      </div>
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
.sub {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 1rem;
  line-height: 1.45;
  max-width: 620px;
  margin: 0;
}
.sub strong {
  color: var(--cream);
}
.hint {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.98rem;
}
.hint.tiny {
  font-size: 0.88rem;
  margin: 0.3rem 0 0.6rem;
}
.hint.warn {
  color: var(--amber);
}
.error-box {
  background: rgba(255, 63, 164, 0.12);
  border: 2px solid var(--magenta);
  color: var(--magenta);
  font-family: "VT323", monospace;
  padding: 0.5rem 0.6rem;
  margin-bottom: 1rem;
}
.info-box {
  background: rgba(94, 234, 212, 0.1);
  border: 2px solid var(--cyan);
  color: var(--cyan);
  font-family: "VT323", monospace;
  padding: 0.5rem 0.6rem;
  margin-bottom: 1rem;
}
.mission {
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 0.9rem 1rem;
  margin-bottom: 0.8rem;
}
.mission-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.mission-title {
  font-family: "VT323", monospace;
  font-size: 1.15rem;
  color: var(--amber);
  flex: 1;
  min-width: 180px;
}
.tag.custom {
  font-family: "VT323", monospace;
  font-size: 0.82rem;
  color: var(--cyan);
  border: 1px solid var(--cyan);
  padding: 0.05rem 0.4rem;
}
.mission-actions {
  display: flex;
  gap: 0.4rem;
}
.editor {
  margin-top: 0.9rem;
  padding-top: 0.9rem;
  border-top: 1px dashed var(--border-dark);
}
.field {
  display: block;
  margin-bottom: 0.7rem;
}
.field span {
  display: block;
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}
.field input,
.field textarea {
  width: 100%;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  color: var(--cream);
  font-family: "VT323", monospace;
  font-size: 1.02rem;
  padding: 0.45rem 0.55rem;
  resize: vertical;
  box-sizing: border-box;
}
.field textarea.mono,
.field input.mono {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.8rem;
  line-height: 1.5;
}
.bugs-heading {
  font-family: "Press Start 2P", monospace;
  font-size: 0.7rem;
  color: var(--cyan);
  margin: 1.1rem 0 0.2rem;
}
.bug-edit {
  border: 1px solid var(--border-dark);
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.6rem;
}
.btn {
  font-family: "Press Start 2P", monospace;
  font-size: 0.65rem;
  padding: 0.55rem 0.85rem;
  cursor: pointer;
  border: 2px solid var(--border-dark);
  outline: 2px solid var(--amber);
  outline-offset: -4px;
  background: var(--amber);
  color: #1a1509;
  font-weight: 700;
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
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
