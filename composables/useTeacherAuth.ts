import { useSupabase } from "~/composables/useSupabase";

export interface TeacherProfile {
  id: string;
  display_name: string;
  email: string | null;
  created_at: string;
}

/** Auth de docente: Supabase Auth normal (email + password). Separado de
 * useProgressSync.ts (auth anónima de alumnos) a propósito — son dos
 * identidades distintas que nunca deberían mezclarse en la misma sesión de
 * navegador (por eso el panel admin y el juego conviene abrirlos en pestañas
 * distintas si se prueban ambos desde la misma compu). */
export function useTeacherAuth() {
  const supabase = useSupabase();

  async function signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() } }
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  /** Devuelve el profile del docente logueado, o null si no hay sesión
   * válida (o si la sesión activa es una sesión anónima de alumno). */
  async function currentTeacher(): Promise<TeacherProfile | null> {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user || user.is_anonymous) return null;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return (profile as TeacherProfile) ?? null;
  }

  return { signUp, signIn, signOut, currentTeacher };
}
