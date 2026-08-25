<script setup lang="ts">
import { useTeacherAuth } from "~/composables/useTeacherAuth";
import { isSupabaseConfigured } from "~/composables/useSupabase";

const { signIn, signUp } = useTeacherAuth();
const supaOn = isSupabaseConfigured();

const mode = ref<"login" | "signup">("login");
const email = ref("");
const password = ref("");
const displayName = ref("");
const loading = ref(false);
const errorMsg = ref("");
const infoMsg = ref("");

function switchMode(next: "login" | "signup") {
  mode.value = next;
  errorMsg.value = "";
  infoMsg.value = "";
}

async function submit() {
  if (loading.value) return;
  errorMsg.value = "";
  infoMsg.value = "";
  loading.value = true;
  try {
    if (mode.value === "login") {
      await signIn(email.value, password.value);
      await navigateTo("/admin");
    } else {
      const data = await signUp(email.value, password.value, displayName.value);
      if (data.session) {
        await navigateTo("/admin");
      } else {
        infoMsg.value = "Cuenta creada. Revisá tu email para confirmarla y después iniciá sesión acá.";
        mode.value = "login";
      }
    }
  } catch (e: any) {
    errorMsg.value = e?.message ?? "Algo salió mal. Probá de nuevo.";
  } finally {
    loading.value = false;
  }
}

const canSubmit = computed(() => {
  if (!email.value.trim() || !password.value) return false;
  if (mode.value === "signup" && !displayName.value.trim()) return false;
  return true;
});
</script>

<template>
  <div class="admin-login">
    <div class="login-box pxframe">
      <div class="eyebrow">// c++ quest — panel docente</div>
      <div class="title">{{ mode === "login" ? "INICIAR SESIÓN" : "CREAR CUENTA" }}</div>

      <p v-if="!supaOn" class="warn">
        Supabase no está configurado en este entorno (falta el .env). El panel docente no va a funcionar hasta
        que se cargue NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_ANON_KEY.
      </p>

      <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>
      <div v-if="infoMsg" class="info-box">{{ infoMsg }}</div>

      <label v-if="mode === 'signup'" class="field">
        <span>Tu nombre</span>
        <input v-model="displayName" type="text" maxlength="60" placeholder="Ej: Prof. Rossofor" />
      </label>
      <label class="field">
        <span>Email</span>
        <input v-model="email" type="email" placeholder="vos@ejemplo.com" @keyup.enter="submit" />
      </label>
      <label class="field">
        <span>Contraseña</span>
        <input v-model="password" type="password" placeholder="••••••••" @keyup.enter="submit" />
      </label>

      <button class="btn" :disabled="!canSubmit || loading" @click="submit">
        {{ loading ? "Conectando…" : mode === "login" ? "▶ Entrar" : "▶ Crear cuenta" }}
      </button>
      <button class="btn link" :disabled="loading" @click="switchMode(mode === 'login' ? 'signup' : 'login')">
        {{ mode === "login" ? "¿No tenés cuenta? Creala" : "¿Ya tenés cuenta? Iniciá sesión" }}
      </button>

      <NuxtLink to="/" class="back-link">← Volver al juego</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.admin-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}
.login-box {
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 1.8rem 1.6rem;
  max-width: 380px;
  width: 100%;
  text-align: center;
}
.eyebrow {
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 0.95rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.title {
  font-family: "Press Start 2P", monospace;
  color: var(--amber);
  font-size: 1.05rem;
  margin: 0.7rem 0 1rem;
  text-shadow: 2px 2px 0 var(--border-dark);
}
.warn {
  background: rgba(255, 176, 0, 0.1);
  border: 2px solid var(--amber);
  color: var(--amber);
  font-family: "VT323", monospace;
  font-size: 0.9rem;
  padding: 0.5rem 0.6rem;
  margin-bottom: 1rem;
  text-align: left;
}
.error-box {
  background: rgba(255, 63, 164, 0.12);
  border: 2px solid var(--magenta);
  color: var(--magenta);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  padding: 0.5rem 0.6rem;
  margin-bottom: 1rem;
  text-align: left;
}
.info-box {
  background: rgba(94, 234, 212, 0.1);
  border: 2px solid var(--cyan);
  color: var(--cyan);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  padding: 0.5rem 0.6rem;
  margin-bottom: 1rem;
  text-align: left;
}
.field {
  display: block;
  text-align: left;
  margin-bottom: 0.9rem;
}
.field span {
  display: block;
  font-family: "VT323", monospace;
  color: var(--cream-dim);
  font-size: 0.9rem;
  margin-bottom: 0.3rem;
}
.field input {
  width: 100%;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  color: var(--cream);
  font-family: "VT323", monospace;
  font-size: 1.1rem;
  padding: 0.5rem 0.6rem;
}
.field input:focus {
  outline-color: var(--amber);
}
.btn {
  width: 100%;
  font-family: "Press Start 2P", monospace;
  font-size: 0.68rem;
  padding: 0.65rem 1rem;
  cursor: pointer;
  border: 2px solid var(--border-dark);
  outline: 2px solid var(--amber);
  outline-offset: -4px;
  background: var(--amber);
  color: #1a1509;
  font-weight: 700;
  transition: transform 0.12s;
  margin-top: 0.3rem;
}
.btn:hover:not(:disabled) {
  transform: translateY(-2px);
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.link {
  background: transparent;
  color: var(--cyan);
  outline: none;
  border: none;
  text-decoration: underline;
  font-size: 0.6rem;
  padding: 0.5rem;
}
.back-link {
  display: block;
  margin-top: 1.2rem;
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
}
</style>
