// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-01-01",
  devtools: { enabled: true },

  // App de estado 100% en el cliente (localStorage), no necesita SSR.
  // Si más adelante lo conectás a Supabase para progreso multi-alumno,
  // podés volver a activar SSR sin tocar los componentes.
  ssr: false,

  modules: ["@vueuse/motion/nuxt"],

  css: ["~/assets/css/main.css"],

  app: {
    head: {
      title: "C++ Quest — Aula Invertida",
      link: [
        {
          rel: "preconnect",
          href: "https://fonts.googleapis.com"
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
        }
      ]
    }
  }
});
