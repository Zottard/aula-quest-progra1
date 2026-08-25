import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton a nivel de módulo, mismo patrón que useGameState.ts: se crea una
// sola vez y la comparten todos los componentes que llaman useSupabase().
// App 100% client-side (ssr:false), así que no hace falta manejar el caso
// server-side por separado.
let client: SupabaseClient | null = null;

export function useSupabase(): SupabaseClient {
  if (client) return client;

  const config = useRuntimeConfig();
  const url = config.public.supabaseUrl as string;
  const anonKey = config.public.supabaseAnonKey as string;

  if (!url || !anonKey) {
    // No tirar excepción dura acá: preferimos que el juego siga siendo
    // jugable 100% local (localStorage) aunque Supabase no esté configurado
    // (ej. desarrollo local sin .env, o mientras se termina de conectar).
    console.warn(
      "[useSupabase] Faltan NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "El sync con el panel docente va a estar deshabilitado."
    );
  }

  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Habilita supabase.auth.signInAnonymously() para la identidad de alumno.
      detectSessionInUrl: false
    }
  });
  return client;
}

/** true si hay credenciales cargadas (no implica que la sesión esté lista). */
export function isSupabaseConfigured(): boolean {
  const config = useRuntimeConfig();
  return !!config.public.supabaseUrl && !!config.public.supabaseAnonKey;
}
