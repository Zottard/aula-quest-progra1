import { useSupabase, isSupabaseConfigured } from "~/composables/useSupabase";
import { useGameState } from "~/composables/useGameState";
import type { Exercise, TestCase } from "~/data/exercises";

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
  testCases: TestCase[];
}

interface ExerciseSetRow {
  id: string;
  aula_id: string;
  teacher_id: string;
  title: string;
  topic: string | null;
  source_pdf_name: string | null;
  status: "draft" | "published" | "archived";
  generated_exercises: GeneratedExercise[];
  created_at: string;
  updated_at: string;
}

function mapRowToExercises(row: ExerciseSetRow): Exercise[] {
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
    topic: "capitulo" as const
  }));
}

/** Se llama una vez por sesión (desde app.vue) para cargar los capítulos
 * publicados del aula del alumno, si tiene una ligada. */
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

  const all = ((data as ExerciseSetRow[]) ?? []).flatMap(mapRowToExercises);
  setChapterExercises(all);
}

/** Manda el texto ya extraído del PDF (ver usePdfExtract.ts) al endpoint
 * que llama a DeepSeek. Tira si algo falla — la UI del docente decide cómo
 * mostrarlo. */
export async function generateChapterFromText(
  text: string
): Promise<{ exercises: GeneratedExercise[]; truncated: boolean }> {
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

export async function publishChapter(params: {
  aulaId: string;
  teacherId: string;
  title: string;
  sourcePdfName?: string;
  exercises: GeneratedExercise[];
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
      generated_exercises: params.exercises
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

export async function deleteChapter(id: string) {
  const supabase = useSupabase();
  const { error } = await supabase.from("exercise_sets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
