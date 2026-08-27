import { reactive } from "vue";
import { useSupabase, isSupabaseConfigured } from "~/composables/useSupabase";
import { useGameState } from "~/composables/useGameState";
import type { Exercise, TestCase } from "~/data/exercises";
import type { Topic } from "~/data/modules";

const BATTLE_TOPICS: readonly Topic[] = ["operadores", "ciclos", "vectores"];

/** La IA a veces devuelve algo raro (o un capítulo viejo no tiene el campo
 * todavía) — en ese caso cae a "capitulo" (neutral en el sistema de batalla)
 * en vez de romper. */
function normalizeTopic(topic: unknown): Topic {
  return BATTLE_TOPICS.includes(topic as Topic) ? (topic as Topic) : "capitulo";
}

// Puente entre exercise_sets (Supabase) y los ejercicios "de capítulo" del
// juego. Todo lo que toca al alumno acá es best-effort (nunca bloquea el
// juego si falla); lo que toca al docente sí propaga errores para que la
// UI del panel admin los muestre.

const CHAPTER_SKELETON = `#include <iostream>
using namespace std;

int main() {


    return 0;
}`;

export interface GeneratedExercise {
  title: string;
  briefing: string;
  /** operadores/ciclos/vectores — lo asigna la IA (o lo corrige el docente en
   * la pantalla de publicación) para que la afinidad de arma también aplique
   * a los capítulos, no solo a las 7 misiones fijas. */
  topic: Topic;
  testCases: TestCase[];
}

/** Una sección de teoría + sus preguntas de comprensión (capítulos kind:"theory",
 * ver server/api/generate-theory.post.ts). Los capítulos de ejercicios NO usan
 * esto — siguen con generated_exercises, son dos flujos separados a propósito. */
export interface TheorySection {
  heading: string;
  body: string;
}
export interface TheoryCheck {
  question: string;
  options: string[];
  correctIndex: number;
}
export interface TheoryContent {
  sections?: TheorySection[];
  checks?: TheoryCheck[];
}

export interface ExerciseSetRow {
  id: string;
  aula_id: string;
  teacher_id: string;
  title: string;
  topic: string | null;
  source_pdf_name: string | null;
  status: "draft" | "published" | "archived";
  /** "exercises" (el generador original) | "theory" (material previo de lectura). */
  kind: "exercises" | "theory";
  generated_exercises: GeneratedExercise[];
  content: TheoryContent;
  /** Fecha límite para tenerlo hecho antes de la clase (opcional). */
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Exportada para que pages/admin/aulas/[id]/index.vue pueda mostrar el
 * desglose de capítulos de un alumno con la misma forma que usa el juego
 * (no solo el docente que los generó). */
export function mapRowToExercises(row: ExerciseSetRow): Exercise[] {
  return (row.generated_exercises ?? []).map((ge, i) => ({
    id: `ch-${row.id}-${i}`,
    title: ge.title,
    concept: row.title,
    briefing: ge.briefing,
    code: CHAPTER_SKELETON,
    testCases: ge.testCases,
    xpReward: 60,
    chapterId: row.id,
    chapterTitle: row.title,
    bugs: [],
    topic: normalizeTopic(ge.topic)
  }));
}

/** Material de teoría publicado del aula del alumno (capítulos kind:"theory").
 * Se guarda aparte de los ejercicios porque no se juega: se lee antes de la
 * clase. Lo consume TheoryPanel.vue. */
const theoryChapters = reactive<ExerciseSetRow[]>([]);
export function useTheoryChapters() {
  return theoryChapters;
}

/** Se llama una vez por sesión (desde app.vue) para cargar los capítulos
 * publicados del aula del alumno, si tiene una ligada. Separa los de
 * ejercicios (jugables) de los de teoría (lectura previa). */
export async function fetchChaptersForAula() {
  const { state, setChapterExercises } = useGameState();
  if (!isSupabaseConfigured() || !state.aulaId) return;

  const supabase = useSupabase();
  const { data, error } = await supabase
    .from("exercise_sets")
    .select("*")
    .eq("aula_id", state.aulaId)
    .eq("status", "published");

  if (error) {
    console.warn("[useChapters] no se pudieron cargar los capítulos:", error.message);
    return;
  }

  const rows = (data as ExerciseSetRow[]) ?? [];
  setChapterExercises(rows.filter((r) => r.kind !== "theory").flatMap(mapRowToExercises));
  theoryChapters.splice(0, theoryChapters.length, ...rows.filter((r) => r.kind === "theory"));
}

/** Manda el texto ya extraído del PDF (ver usePdfExtract.ts) al endpoint
 * que llama a DeepSeek. Tira si algo falla — la UI del docente decide cómo
 * mostrarlo. */
export async function generateChapterFromText(
  text: string
): Promise<{ exercises: GeneratedExercise[]; truncated: boolean; capped: boolean }> {
  const res = await fetch("/api/generate-chapter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.statusMessage ?? `Error ${res.status} generando el capítulo.`);
  }
  return res.json();
}

/** Trae TODOS los capítulos de un aula (cualquier status), para la lista del
 * docente en el panel admin. RLS ya scopea por teacher_id = auth.uid(). */
export async function listChaptersForAula(aulaId: string): Promise<ExerciseSetRow[]> {
  const supabase = useSupabase();
  const { data, error } = await supabase
    .from("exercise_sets")
    .select("*")
    .eq("aula_id", aulaId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as ExerciseSetRow[]) ?? [];
}

/** Igual que generateChapterFromText pero para material de TEORÍA (endpoint
 * distinto, prompt distinto). Los dos flujos conviven: un aula puede tener
 * capítulos de lectura y capítulos de ejercicios al mismo tiempo. */
export async function generateTheoryFromText(text: string): Promise<{
  title: string;
  sections: TheorySection[];
  checks: TheoryCheck[];
  truncated: boolean;
}> {
  const res = await fetch("/api/generate-theory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.statusMessage ?? `Error ${res.status} generando la teoría.`);
  }
  return res.json();
}

export async function publishChapter(params: {
  aulaId: string;
  teacherId: string;
  title: string;
  sourcePdfName?: string;
  exercises: GeneratedExercise[];
  dueAt?: string | null;
}): Promise<ExerciseSetRow> {
  const supabase = useSupabase();
  const { data, error } = await supabase
    .from("exercise_sets")
    .insert({
      teacher_id: params.teacherId,
      aula_id: params.aulaId,
      title: params.title,
      source_pdf_name: params.sourcePdfName ?? null,
      status: "published",
      kind: "exercises",
      generated_exercises: params.exercises,
      due_at: params.dueAt || null
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ExerciseSetRow;
}

export async function publishTheory(params: {
  aulaId: string;
  teacherId: string;
  title: string;
  sourcePdfName?: string;
  content: TheoryContent;
  dueAt?: string | null;
}): Promise<ExerciseSetRow> {
  const supabase = useSupabase();
  const { data, error } = await supabase
    .from("exercise_sets")
    .insert({
      teacher_id: params.teacherId,
      aula_id: params.aulaId,
      title: params.title,
      source_pdf_name: params.sourcePdfName ?? null,
      status: "published",
      kind: "theory",
      content: params.content,
      due_at: params.dueAt || null
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ExerciseSetRow;
}

export async function setChapterStatus(id: string, status: "draft" | "published" | "archived") {
  const supabase = useSupabase();
  const { error } = await supabase.from("exercise_sets").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Editar un capítulo YA publicado (feature F). Antes, si la IA se mandaba
 * una macana en un caso de prueba, la única salida era borrar y regenerar —
 * pagando otra vez la llamada a DeepSeek y perdiendo el progreso que los
 * alumnos ya tenían en ese capítulo. */
export async function updateChapter(
  id: string,
  patch: Partial<Pick<ExerciseSetRow, "title" | "generated_exercises" | "content" | "due_at">>
) {
  const supabase = useSupabase();
  const { error } = await supabase
    .from("exercise_sets")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteChapter(id: string) {
  const supabase = useSupabase();
  const { error } = await supabase.from("exercise_sets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
