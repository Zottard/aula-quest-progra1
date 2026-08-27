import { useSupabase } from "~/composables/useSupabase";
import { EXERCISES, type Exercise } from "~/data/exercises";
import { listChaptersForAula, mapRowToExercises } from "~/composables/useChapters";
import type { FailReason } from "~/composables/useProgressSync";

// "Just-in-Time Teaching": el docente mira en qué se traba la clase ANTES de
// la clase y adapta lo que va a explicar. Los datos ya se venían guardando en
// progress_events desde siempre; esto es lo que finalmente los lee.
//
// Se agrega en el cliente a propósito: PostgREST no hace GROUP BY, y para un
// aula real (decenas de alumnos, cientos/miles de eventos) traer las filas y
// contarlas acá es más simple que mantener vistas SQL por cada corte que se
// nos ocurra mirar.

export const FAIL_REASON_LABEL: Record<FailReason, string> = {
  compile_error: "No compila",
  wrong_output: "Resultado incorrecto",
  runtime_error: "Falla al ejecutar",
  timeout: "No termina (bucle infinito)",
  network_error: "Error de red"
};

/** Qué sugiere pedagógicamente cada tipo de error dominante. */
export const FAIL_REASON_HINT: Record<FailReason, string> = {
  compile_error: "Traban en sintaxis: repasá estructura básica, puntos y coma, tipos.",
  wrong_output: "Compilan bien pero la lógica falla: repasá el razonamiento del problema.",
  runtime_error: "Errores en ejecución: típicamente índices fuera de rango o división por cero.",
  timeout: "Bucles que no cortan: repasá la condición de corte y el incremento.",
  network_error: "Problema del compilador online, no de los alumnos."
};

export interface ExerciseTrouble {
  exerciseId: string;
  title: string;
  isChapter: boolean;
  failedAttempts: number;
  studentsAttempted: number;
  studentsCompleted: number;
  studentsStuck: number;
  byReason: Partial<Record<FailReason, number>>;
  topReason: FailReason | null;
}

export interface StudentPulse {
  studentId: string;
  realName: string;
  username: string;
  lastSeenAt: string;
  completed: number;
  failedAttempts: number;
  /** Señal de alarma: intentó mucho y no completó nada. */
  strugglingScore: number;
}

export interface ClassInsights {
  totalStudents: number;
  activeStudents: number;
  neverStarted: StudentPulse[];
  struggling: StudentPulse[];
  troubles: ExerciseTrouble[];
  reasonTotals: Partial<Record<FailReason, number>>;
  allExercises: Exercise[];
  generatedAt: string;
}

interface EventRow {
  student_id: string;
  exercise_id: string;
  event_type: "solved" | "wrong" | "complete" | "levelup";
  fail_reason: FailReason | null;
  created_at: string;
}

interface StudentRowLite {
  id: string;
  real_name: string;
  username: string;
  last_seen_at: string;
  game_state: { exercises?: Record<string, { completed?: boolean }> } | null;
}

const INACTIVE_DAYS = 7;

export async function fetchClassInsights(aulaId: string): Promise<ClassInsights> {
  const supabase = useSupabase();

  const [{ data: studentsData, error: sErr }, chapterRows] = await Promise.all([
    supabase.from("students").select("id, real_name, username, last_seen_at, game_state").eq("aula_id", aulaId),
    listChaptersForAula(aulaId).catch(() => [])
  ]);
  if (sErr) throw new Error(sErr.message);

  const students = (studentsData as StudentRowLite[]) ?? [];
  const studentIds = students.map((s) => s.id);

  const chapterExercises = (chapterRows ?? [])
    .filter((r: any) => r.status === "published" && r.kind !== "theory")
    .flatMap(mapRowToExercises);
  const allExercises: Exercise[] = [...EXERCISES, ...chapterExercises];
  const titleOf = (id: string) => allExercises.find((e) => e.id === id)?.title ?? id;
  const isChapterId = (id: string) => id.startsWith("ch-");

  let events: EventRow[] = [];
  if (studentIds.length > 0) {
    const { data: evData, error: evErr } = await supabase
      .from("progress_events")
      .select("student_id, exercise_id, event_type, fail_reason, created_at")
      .in("student_id", studentIds)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (evErr) throw new Error(evErr.message);
    events = (evData as EventRow[]) ?? [];
  }

  // ---- agregación por ejercicio ----
  const byExercise = new Map<
    string,
    { failed: number; attempted: Set<string>; completed: Set<string>; stuck: Set<string>; reasons: Partial<Record<FailReason, number>> }
  >();
  const reasonTotals: Partial<Record<FailReason, number>> = {};

  function slot(id: string) {
    if (!byExercise.has(id)) {
      byExercise.set(id, { failed: 0, attempted: new Set(), completed: new Set(), stuck: new Set(), reasons: {} });
    }
    return byExercise.get(id)!;
  }

  for (const ev of events) {
    const s = slot(ev.exercise_id);
    if (ev.event_type === "wrong") {
      s.failed++;
      s.attempted.add(ev.student_id);
      if (ev.fail_reason) {
        s.reasons[ev.fail_reason] = (s.reasons[ev.fail_reason] ?? 0) + 1;
        reasonTotals[ev.fail_reason] = (reasonTotals[ev.fail_reason] ?? 0) + 1;
      }
    } else if (ev.event_type === "complete") {
      s.completed.add(ev.student_id);
      s.attempted.add(ev.student_id);
    } else if (ev.event_type === "solved") {
      s.attempted.add(ev.student_id);
    }
  }

  const troubles: ExerciseTrouble[] = [...byExercise.entries()]
    .map(([exerciseId, s]) => {
      for (const sid of s.attempted) if (!s.completed.has(sid)) s.stuck.add(sid);
      const topReason =
        (Object.entries(s.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] as FailReason | undefined) ?? null;
      return {
        exerciseId,
        title: titleOf(exerciseId),
        isChapter: isChapterId(exerciseId),
        failedAttempts: s.failed,
        studentsAttempted: s.attempted.size,
        studentsCompleted: s.completed.size,
        studentsStuck: s.stuck.size,
        byReason: s.reasons,
        topReason
      };
    })
    // Prioridad: lo que más alumnos distintos tiene trabados, y a igualdad, lo que más intentos consumió.
    .sort((a, b) => b.studentsStuck - a.studentsStuck || b.failedAttempts - a.failedAttempts);

  // ---- pulso por alumno ----
  const failedByStudent = new Map<string, number>();
  for (const ev of events) {
    if (ev.event_type === "wrong") failedByStudent.set(ev.student_id, (failedByStudent.get(ev.student_id) ?? 0) + 1);
  }

  const cutoff = Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000;
  const pulses: StudentPulse[] = students.map((s) => {
    const exs = s.game_state?.exercises ?? {};
    const completed = Object.values(exs).filter((e) => e?.completed).length;
    const failedAttempts = failedByStudent.get(s.id) ?? 0;
    return {
      studentId: s.id,
      realName: s.real_name,
      username: s.username,
      lastSeenAt: s.last_seen_at,
      completed,
      failedAttempts,
      // Intentó mucho y avanzó poco: el que probablemente necesita ayuda y no la pidió.
      strugglingScore: failedAttempts / (completed + 1)
    };
  });

  return {
    totalStudents: students.length,
    activeStudents: pulses.filter((p) => new Date(p.lastSeenAt).getTime() >= cutoff).length,
    neverStarted: pulses.filter((p) => p.completed === 0 && p.failedAttempts === 0),
    struggling: pulses
      .filter((p) => p.failedAttempts >= 3 && p.strugglingScore >= 2)
      .sort((a, b) => b.strugglingScore - a.strugglingScore),
    troubles,
    reasonTotals,
    allExercises,
    generatedAt: new Date().toISOString()
  };
}
