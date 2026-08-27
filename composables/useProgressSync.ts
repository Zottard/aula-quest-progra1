import { watch } from "vue";
import { useGameState, type StudentRow } from "~/composables/useGameState";
import { useEventBus } from "~/composables/useEventBus";
import { useSupabase, isSupabaseConfigured } from "~/composables/useSupabase";

// Puente entre el juego 100% local (useGameState) y el panel docente en
// Supabase. Todo acá es "best effort": si algo falla (sin conexión, RLS,
// lo que sea), el juego sigue jugable local — nunca bloqueamos checkCode()
// ni el resto de la UI por un error de red.

let initialized = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Reusa la sesión anónima persistida en este navegador si ya existe
 * (supabase-js la guarda sola en localStorage); si no hay ninguna, crea una
 * nueva. Nunca pisa una sesión ya reclamada por un username. */
async function ensureAnonSession() {
  const supabase = useSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

function syncedPayload(state: ReturnType<typeof useGameState>["state"]) {
  return {
    xp: state.xp,
    exercises: state.exercises,
    equipment: state.equipment,
    unlockedSkills: state.unlockedSkills,
    theoryDone: state.theoryDone,
    avatarId: state.avatarId
  };
}

async function pushGameState() {
  if (!isSupabaseConfigured()) return;
  const { state } = useGameState();
  if (!state.studentId) return;
  const supabase = useSupabase();
  const { error } = await supabase
    .from("students")
    .update({ game_state: syncedPayload(state) })
    .eq("id", state.studentId);
  if (error) console.warn("[useProgressSync] no se pudo sincronizar el progreso:", error.message);
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushGameState();
  }, 900);
}

/** Motivo por el que falló un intento. Se guarda solo en eventos "wrong" y
 * es lo que le permite al docente distinguir "la clase no sabe compilar"
 * (compile_error) de "la clase tiene mal la lógica" (wrong_output), que
 * piden intervenciones distintas. Ver el panel en /admin/aulas/[id]/clase. */
export type FailReason = "compile_error" | "wrong_output" | "runtime_error" | "timeout" | "network_error";

async function logEvent(entry: {
  exerciseId: string;
  bugId?: string | null;
  type: "solved" | "wrong" | "complete" | "levelup";
  hinted?: boolean;
  xpGained?: number;
  failReason?: FailReason | null;
}) {
  if (!isSupabaseConfigured()) return;
  const { state } = useGameState();
  if (!state.studentId) return;
  const supabase = useSupabase();
  const { error } = await supabase.from("progress_events").insert({
    student_id: state.studentId,
    exercise_id: entry.exerciseId,
    bug_id: entry.bugId ?? null,
    event_type: entry.type,
    hinted: !!entry.hinted,
    xp_gained: entry.xpGained ?? 0,
    fail_reason: entry.failReason ?? null
  });
  if (error) console.warn("[useProgressSync] no se pudo loguear el evento:", error.message);
}

/** Primera vez: código de aula + los 3 nombres. Sube el progreso local
 * existente (si el alumno ya venía jugando en este navegador) como punto
 * de partida del alumno en la base. */
export async function registerStudent(
  joinCode: string,
  realName: string,
  username: string,
  characterName: string
): Promise<StudentRow> {
  await ensureAnonSession();
  const supabase = useSupabase();
  const { data, error } = await supabase.rpc("register_student", {
    p_join_code: joinCode.trim(),
    p_real_name: realName.trim(),
    p_username: username.trim(),
    p_character_name: characterName.trim()
  });
  if (error) throw new Error(error.message);
  const row = data as StudentRow;
  const { setIdentityFromStudent } = useGameState();
  setIdentityFromStudent(row, false);
  await pushGameState();
  return row;
}

/** "Ya tengo usuario": re-liga el username a la sesión anónima de este
 * dispositivo y trae el progreso real desde la base (puede venir de otro
 * dispositivo, así que acá el remoto pisa al local). */
export async function claimStudent(username: string): Promise<StudentRow> {
  await ensureAnonSession();
  const supabase = useSupabase();
  const { data, error } = await supabase.rpc("claim_student_by_username", {
    p_username: username.trim()
  });
  if (error) throw new Error(error.message);
  const row = data as StudentRow;
  const { setIdentityFromStudent } = useGameState();
  setIdentityFromStudent(row, true);
  return row;
}

/** Actualiza nombre real / nombre de personaje en la fila students, para que
 * el panel docente no quede desactualizado si el alumno se renombra después
 * de haberse registrado. */
export async function updateStudentProfile(realName: string, characterName: string) {
  if (!isSupabaseConfigured()) return;
  const { state } = useGameState();
  if (!state.studentId) return;
  const supabase = useSupabase();
  const { error } = await supabase
    .from("students")
    .update({ real_name: realName.trim(), character_name: characterName.trim() })
    .eq("id", state.studentId);
  if (error) console.warn("[useProgressSync] no se pudo actualizar el perfil:", error.message);
}

/** Se llama una sola vez desde app.vue. Mientras haya una identidad ligada
 * (state.studentId), sube el estado del juego (debounced) en cada cambio y
 * deja un log de cada evento del bus para la analítica del docente
 * ("¿qué bug traba a más alumnos?"). */
export function initProgressSync() {
  if (initialized || !import.meta.client || !isSupabaseConfigured()) return;
  initialized = true;

  const { state } = useGameState();
  const bus = useEventBus();

  watch(
    () => [state.xp, state.exercises, state.equipment, state.unlockedSkills, state.theoryDone, state.avatarId],
    () => {
      if (state.studentId) schedulePush();
    },
    { deep: true }
  );

  bus.on("solved", (p: any) =>
    logEvent({
      exerciseId: p?.exerciseId,
      bugId: p?.bugId,
      type: "solved",
      hinted: p?.hinted,
      xpGained: p?.xpGain
    })
  );
  bus.on("wrong", (p: any) =>
    logEvent({ exerciseId: p?.exerciseId, type: "wrong", failReason: p?.reason ?? null })
  );
  bus.on("complete", (p: any) => logEvent({ exerciseId: p?.exerciseId, type: "complete" }));
  bus.on("levelup", () => logEvent({ exerciseId: state.activeId, type: "levelup" }));
}
