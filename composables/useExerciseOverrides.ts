import { reactive } from "vue";
import { useSupabase, isSupabaseConfigured } from "~/composables/useSupabase";
import type { Exercise, Bug } from "~/data/exercises";

// Overrides por aula de las 7 misiones fijas.
//
// Las misiones fijas viven en data/exercises.ts y son globales — el juego
// tiene que poder correr sin Supabase configurado. Para que un docente pueda
// adaptar el enunciado o el resultado esperado a su comisión sin romper eso
// (ni afectar a las otras comisiones), se guarda un PARCHE por aula y se
// aplica encima de la definición global al cargar.

/** Solo estos campos se pueden pisar. `bugs` se mergea por id (no reemplaza
 * el array entero) para no poder romper la lógica de XP ni perder bugs. */
export interface ExercisePatch {
  title?: string;
  briefing?: string;
  code?: string;
  expectedOutput?: string;
  bugs?: { id: string; label?: string; hint?: string; explanation?: string }[];
}

export interface ExerciseOverrideRow {
  id: string;
  aula_id: string;
  teacher_id: string;
  exercise_id: string;
  patch: ExercisePatch;
  updated_at: string;
}

/** Parches del aula del alumno, por exercise_id. Se llena en cada sesión
 * desde Supabase; sin aula (o sin Supabase) queda vacío y las misiones se
 * ven exactamente como están en data/exercises.ts. */
const overrides = reactive<Record<string, ExercisePatch>>({});

export function useExerciseOverrides() {
  return overrides;
}

export function setOverrides(map: Record<string, ExercisePatch>) {
  for (const k of Object.keys(overrides)) delete overrides[k];
  Object.assign(overrides, map);
}

/** Aplica el parche de un aula sobre una misión fija. Devuelve el ejercicio
 * original si no hay nada que pisar, para no crear objetos de más. */
export function applyPatch(exercise: Exercise, patch: ExercisePatch | undefined): Exercise {
  if (!patch || Object.keys(patch).length === 0) return exercise;

  const merged: Exercise = { ...exercise };
  if (typeof patch.title === "string" && patch.title.trim()) merged.title = patch.title;
  if (typeof patch.briefing === "string" && patch.briefing.trim()) merged.briefing = patch.briefing;
  if (typeof patch.code === "string" && patch.code.trim()) merged.code = patch.code;
  // El output esperado sí puede quedar vacío a propósito (programa que no
  // imprime nada), así que acá alcanza con que la clave exista.
  if (typeof patch.expectedOutput === "string") merged.expectedOutput = patch.expectedOutput;

  if (Array.isArray(patch.bugs) && patch.bugs.length > 0) {
    merged.bugs = exercise.bugs.map((bug): Bug => {
      const p = patch.bugs!.find((b) => b.id === bug.id);
      if (!p) return bug;
      return {
        ...bug,
        label: p.label?.trim() ? p.label : bug.label,
        hint: p.hint?.trim() ? p.hint : bug.hint,
        explanation: p.explanation?.trim() ? p.explanation : bug.explanation
      };
    });
  }

  return merged;
}

/** Se llama desde app.vue junto con los capítulos: trae los parches del aula
 * del alumno. Best-effort, igual que el resto del sync. */
export async function fetchOverridesForAula(aulaId: string | null) {
  if (!isSupabaseConfigured() || !aulaId) {
    setOverrides({});
    return;
  }
  const supabase = useSupabase();
  const { data, error } = await supabase
    .from("exercise_overrides")
    .select("exercise_id, patch")
    .eq("aula_id", aulaId);

  if (error) {
    console.warn("[useExerciseOverrides] no se pudieron cargar los overrides:", error.message);
    return;
  }
  const map: Record<string, ExercisePatch> = {};
  for (const row of (data as { exercise_id: string; patch: ExercisePatch }[]) ?? []) {
    map[row.exercise_id] = row.patch ?? {};
  }
  setOverrides(map);
}

/* ---------------- lado docente ---------------- */

export async function listOverridesForAula(aulaId: string): Promise<ExerciseOverrideRow[]> {
  const supabase = useSupabase();
  const { data, error } = await supabase.from("exercise_overrides").select("*").eq("aula_id", aulaId);
  if (error) throw new Error(error.message);
  return (data as ExerciseOverrideRow[]) ?? [];
}

export async function saveOverride(params: {
  aulaId: string;
  teacherId: string;
  exerciseId: string;
  patch: ExercisePatch;
}) {
  const supabase = useSupabase();
  const { error } = await supabase.from("exercise_overrides").upsert(
    {
      aula_id: params.aulaId,
      teacher_id: params.teacherId,
      exercise_id: params.exerciseId,
      patch: params.patch,
      updated_at: new Date().toISOString()
    },
    { onConflict: "aula_id,exercise_id" }
  );
  if (error) throw new Error(error.message);
}

/** Volver una misión a su versión original de fábrica. */
export async function resetOverride(aulaId: string, exerciseId: string) {
  const supabase = useSupabase();
  const { error } = await supabase
    .from("exercise_overrides")
    .delete()
    .eq("aula_id", aulaId)
    .eq("exercise_id", exerciseId);
  if (error) throw new Error(error.message);
}
