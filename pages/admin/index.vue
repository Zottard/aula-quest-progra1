<script setup lang="ts">
import { useSupabase } from "~/composables/useSupabase";
import { useTeacherAuth, type TeacherProfile } from "~/composables/useTeacherAuth";
import { copyChaptersToAula } from "~/composables/useChapters";

definePageMeta({ middleware: "admin-auth" });

interface Aula {
  id: string;
  name: string;
  join_code: string;
  archived: boolean;
  created_at: string;
}

const supabase = useSupabase();
const { signOut, currentTeacher } = useTeacherAuth();

const teacher = ref<TeacherProfile | null>(null);
const aulas = ref<Aula[]>([]);
const studentCounts = ref<Record<string, number>>({});
const loading = ref(true);
const errorMsg = ref("");

const newAulaName = ref("");
const creating = ref(false);

const JOIN_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I/L, menos confusión al dictarlo en clase

function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return code;
}

async function loadAulas() {
  loading.value = true;
  errorMsg.value = "";
  const { data, error } = await supabase.from("aulas").select("*").order("created_at", { ascending: false });
  if (error) {
    errorMsg.value = error.message;
    loading.value = false;
    return;
  }
  aulas.value = (data as Aula[]) ?? [];

  if (aulas.value.length > 0) {
    const { data: overview } = await supabase
      .from("students_overview")
      .select("aula_id")
      .in(
        "aula_id",
        aulas.value.map((a) => a.id)
      );
    const counts: Record<string, number> = {};
    for (const row of overview ?? []) {
      counts[row.aula_id] = (counts[row.aula_id] ?? 0) + 1;
    }
    studentCounts.value = counts;
  }
  loading.value = false;
}

async function createAula() {
  if (!newAulaName.value.trim() || creating.value) return;
  creating.value = true;
  errorMsg.value = "";
  // Reintenta una vez si el código generado ya existe (colisión muy poco probable con 6 chars).
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.from("aulas").insert({
      name: newAulaName.value.trim(),
      teacher_id: teacher.value?.id,
      join_code: generateJoinCode()
    });
    if (!error) {
      newAulaName.value = "";
      await loadAulas();
      creating.value = false;
      return;
    }
    if (!error.message.includes("duplicate") && !error.message.includes("unique")) {
      errorMsg.value = error.message;
      creating.value = false;
      return;
    }
  }
  errorMsg.value = "No se pudo generar un código de aula único, probá de nuevo.";
  creating.value = false;
}

/* ---------------- duplicar un aula para otra comisión ---------------- */
const duplicatingId = ref<string | null>(null);

async function duplicateAula(source: Aula) {
  if (duplicatingId.value || !teacher.value) return;
  const name = prompt(
    `Nombre del aula nueva (se copia el contenido de "${source.name}", no los alumnos):`,
    `${source.name} — copia`
  );
  if (name === null) return;
  const finalName = name.trim() || `${source.name} — copia`;

  duplicatingId.value = source.id;
  errorMsg.value = "";
  try {
    // 1) aula nueva con su propio código de invitación
    let created: Aula | null = null;
    for (let attempt = 0; attempt < 2 && !created; attempt++) {
      const { data, error } = await supabase
        .from("aulas")
        .insert({ name: finalName, teacher_id: teacher.value.id, join_code: generateJoinCode() })
        .select()
        .single();
      if (!error) {
        created = data as Aula;
        break;
      }
      if (!error.message.includes("duplicate") && !error.message.includes("unique")) {
        throw new Error(error.message);
      }
    }
    if (!created) throw new Error("No se pudo generar un código de aula único, probá de nuevo.");

    // 2) copiar los capítulos (el aula queda vacía de alumnos, con el contenido listo)
    const n = await copyChaptersToAula(source.id, created.id, teacher.value.id);
    await loadAulas();
    duplicatedMsg.value = `Se creó "${finalName}" con ${n} capítulo(s) copiados. Revisá las fechas límite: quedaron vacías.`;
  } catch (e: any) {
    errorMsg.value = e?.message ?? "No se pudo duplicar el aula.";
  } finally {
    duplicatingId.value = null;
  }
}

const duplicatedMsg = ref("");

async function logout() {
  await signOut();
  await navigateTo("/admin/login");
}

const copiedCode = ref<string | null>(null);
async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    copiedCode.value = code;
    setTimeout(() => {
      if (copiedCode.value === code) copiedCode.value = null;
    }, 1500);
  } catch {
    // clipboard puede fallar por permisos; no es crítico.
  }
}

onMounted(async () => {
  teacher.value = await currentTeacher();
  if (!teacher.value) {
    await navigateTo("/admin/login");
    return;
  }
  await loadAulas();
});
</script>

<template>
  <div class="admin-page">
    <header class="admin-header">
      <div>
        <div class="eyebrow">// c++ quest — panel docente</div>
        <h1>Mis aulas</h1>
      </div>
      <div class="header-actions">
        <span v-if="teacher" class="teacher-name">{{ teacher.display_name }}</span>
        <button class="btn ghost small" @click="logout">Cerrar sesión</button>
      </div>
    </header>

    <section class="create-box pxframe">
      <label class="field">
        <span>Nombre de la aula nueva</span>
        <input v-model="newAulaName" type="text" maxlength="60" placeholder="Ej: Progra 1 — Comisión A" @keyup.enter="createAula" />
      </label>
      <button class="btn" :disabled="!newAulaName.trim() || creating" @click="createAula">
        {{ creating ? "Creando…" : "+ Crear aula" }}
      </button>
    </section>

    <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>
    <div v-if="duplicatedMsg" class="info-box">{{ duplicatedMsg }}</div>

    <p v-if="loading" class="loading">Cargando…</p>
    <p v-else-if="aulas.length === 0" class="empty">Todavía no creaste ninguna aula.</p>

    <div v-else class="aulas-grid">
      <NuxtLink v-for="a in aulas" :key="a.id" :to="`/admin/aulas/${a.id}`" class="aula-card pxframe">
        <div class="aula-name">{{ a.name }}</div>
        <div class="aula-meta">{{ studentCounts[a.id] ?? 0 }} alumno(s)</div>
        <div class="join-code-row" @click.prevent="copyCode(a.join_code)">
          <span class="join-code">{{ a.join_code }}</span>
          <span class="copy-hint">{{ copiedCode === a.join_code ? "¡copiado!" : "copiar" }}</span>
        </div>
        <button
          class="dup-btn"
          :disabled="duplicatingId === a.id"
          title="Crear otra comisión con el mismo contenido"
          @click.prevent.stop="duplicateAula(a)"
        >
          {{ duplicatingId === a.id ? "duplicando…" : "⧉ duplicar para otra comisión" }}
        </button>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem 1.2rem 3rem;
}
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 1.6rem;
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
  font-size: 1.3rem;
  margin: 0.5rem 0 0;
  text-shadow: 2px 2px 0 var(--border-dark);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.teacher-name {
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 1.05rem;
}
.create-box {
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 1.2rem 1.4rem;
  margin-bottom: 1.6rem;
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  flex-wrap: wrap;
}
.field {
  display: block;
  text-align: left;
  flex: 1;
  min-width: 220px;
}
.field span {
  display: block;
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.9rem;
  margin-bottom: 0.3rem;
}
.field input {
  width: 100%;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  color: var(--cream);
  font-family: "VT323", monospace;
  font-size: 1.1rem;
  padding: 0.5rem 0.6rem;
}
.btn {
  font-family: "Press Start 2P", monospace;
  font-size: 0.65rem;
  padding: 0.65rem 1rem;
  cursor: pointer;
  border: 2px solid var(--border-dark);
  outline: 2px solid var(--amber);
  outline-offset: -4px;
  background: var(--amber);
  color: #1a1509;
  font-weight: 700;
  white-space: nowrap;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.ghost {
  background: var(--bg-panel);
  color: var(--cream-dim);
  outline-color: var(--border-light);
}
.btn.small {
  font-size: 0.6rem;
  padding: 0.5rem 0.8rem;
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
.aulas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
.aula-card {
  display: block;
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 1.1rem 1.2rem;
  text-decoration: none;
  color: var(--cream);
  transition: transform 0.12s;
}
.aula-card:hover {
  transform: translateY(-3px);
  border-color: var(--amber);
}
.aula-name {
  font-family: "Press Start 2P", monospace;
  font-size: 0.85rem;
  color: var(--amber);
  margin-bottom: 0.5rem;
  line-height: 1.4;
}
.aula-meta {
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 1rem;
  margin-bottom: 0.7rem;
}
.join-code-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #0a0810;
  border: 2px dashed var(--border-light);
  padding: 0.4rem 0.6rem;
  cursor: pointer;
}
.join-code {
  font-family: "VT323", monospace;
  font-size: 1.25rem;
  letter-spacing: 0.15em;
  color: var(--cyan);
}
.copy-hint {
  font-family: "VT323", monospace;
  font-size: 0.85rem;
  color: var(--cream-dim);
}
.dup-btn {
  width: 100%;
  margin-top: 0.55rem;
  background: none;
  border: 1px solid var(--border-light);
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.9rem;
  padding: 0.3rem 0.4rem;
  cursor: pointer;
}
.dup-btn:hover:not(:disabled) {
  border-color: var(--cyan);
  color: var(--cyan);
}
.dup-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}
.info-box {
  background: rgba(94, 234, 212, 0.1);
  border: 2px solid var(--cyan);
  color: var(--cyan);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  padding: 0.5rem 0.6rem;
  margin-bottom: 1rem;
}
</style>
