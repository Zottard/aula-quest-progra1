import { useSupabase, isSupabaseConfigured } from "~/composables/useSupabase";

// Protege /admin/** — corre en el cliente (ssr:false, app 100% SPA).
export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return;
  if (to.path === "/admin/login") return;

  if (!isSupabaseConfigured()) {
    return navigateTo("/admin/login");
  }

  const supabase = useSupabase();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  // Una sesión anónima (alumno) no cuenta como sesión docente.
  if (!user || user.is_anonymous) {
    return navigateTo("/admin/login");
  }
});
