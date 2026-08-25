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

  // Credenciales públicas de Supabase (anon/publishable key, protegida por RLS
  // en la base — no es secreta). Se leen de variables de entorno con prefijo
  // NUXT_PUBLIC_ para que Nuxt las exponga al cliente. Ver .env.example.
  //
  // deepseekApiKey NO va dentro de `public`: a propósito, para que Nitro la
  // lea solo del lado servidor (server/api/generate-chapter.post.ts) y nunca
  // viaje al bundle del cliente — es una key paga de verdad, a diferencia de
  // la anon key de Supabase.
  runtimeConfig: {
    deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
    }
  },

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
