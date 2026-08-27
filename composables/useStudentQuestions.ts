import { useSupabase, isSupabaseConfigured } from "~/composables/useSupabase";
import { useGameState } from "~/composables/useGameState";

// Una queja recurrente del aula invertida es que, durante el trabajo previo,
// el alumno se traba y no tiene a quién preguntarle — y llega a clase
// frustrado o directamente no llega. Esto le da un canal asincrónico: deja la
// duda con una foto de su código, y el docente la ve toda junta antes de la
// clase (Just-in-Time Teaching).

export interface StudentQuestion {
  id: number;
  student_id: string;
  aula_id: string;
  exercise_id: string;
  exercise_title: string | null;
  message: string | null;
  code_snapshot: string | null;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
}

/** Lo manda el alumno desde el ejercicio en el que se trabó. */
export async function askForHelp(params: {
  exerciseId: string;
  exerciseTitle: string;
  message: string;
  code: string;
}) {
  if (!isSupabaseConfigured()) throw new Error("Necesitás estar en un aula para pedir ayuda.");
  const { state } = useGameState();
  if (!state.studentId || !state.aulaId) throw new Error("Necesitás estar en un aula para pedir ayuda.");

  const supabase = useSupabase();
  const { error } = await supabase.from("student_questions").insert({
    student_id: state.studentId,
    aula_id: state.aulaId,
    exercise_id: params.exerciseId,
    exercise_title: params.exerciseTitle,
    message: params.message.trim().slice(0, 1000),
    // Guardamos el código tal como estaba al momento de trabarse: sin esto el
    // docente ve "no me sale" sin poder hacer nada con eso.
    code_snapshot: params.code.slice(0, 8000)
  });
  if (error) throw new Error(error.message);
}

/** Las dudas del aula, para el panel docente. Trae también el nombre del
 * alumno vía el join que ya permite RLS. */
export async function listQuestionsForAula(
  aulaId: string,
  status: "open" | "resolved" | "all" = "open"
): Promise<(StudentQuestion & { students?: { real_name: string; username: string } })[]> {
  const supabase = useSupabase();
  let q = supabase
    .from("student_questions")
    .select("*, students(real_name, username)")
    .eq("aula_id", aulaId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as any) ?? [];
}

export async function resolveQuestion(id: number) {
  const supabase = useSupabase();
  const { error } = await supabase
    .from("student_questions")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
