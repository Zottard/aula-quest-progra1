<script setup lang="ts">
import { useGameState } from "~/composables/useGameState";
import { useEventBus } from "~/composables/useEventBus";
import { isSupabaseConfigured } from "~/composables/useSupabase";
import { registerStudent, claimStudent, updateStudentProfile } from "~/composables/useProgressSync";

const { state, hasIdentity, setNames, isLinkedToAula } = useGameState();
const bus = useEventBus();

// Si no hay credenciales de Supabase cargadas (ej. dev local sin .env), el
// juego sigue andando 100% local con el formulario simple de siempre.
const supaOn = isSupabaseConfigured();

const forceOpen = ref(false);
const mode = ref<"register" | "claim">("register");
const loading = ref(false);
const errorMsg = ref("");

// Formulario legado (sin Supabase configurado)
const studentInput = ref("");
const avatarInput = ref("");

// Registro (código de aula + los 3 nombres)
const joinCode = ref("");
const realName = ref("");
const username = ref("");
const characterName = ref("");

// "Ya tengo usuario"
const loginUsername = ref("");

// Edición de perfil ya existente
const editReal = ref("");
const editChar = ref("");

const isEditing = computed(() => forceOpen.value && (supaOn ? isLinkedToAula.value : hasIdentity.value));
const show = computed(() => {
  if (forceOpen.value) return true;
  return supaOn ? !isLinkedToAula.value : !hasIdentity.value;
});
const isFirstTime = computed(() => (supaOn ? !isLinkedToAula.value : !hasIdentity.value));

function resetErrors() {
  errorMsg.value = "";
}

function openEditor() {
  studentInput.value = state.studentName;
  avatarInput.value = state.avatarName;
  editReal.value = state.studentName;
  editChar.value = state.avatarName;
  resetErrors();
  forceOpen.value = true;
}
function onOpenRequest() {
  openEditor();
}
onMounted(() => {
  studentInput.value = state.studentName;
  avatarInput.value = state.avatarName;
  bus.on("openOnboarding", onOpenRequest);
});
onUnmounted(() => bus.off("openOnboarding", onOpenRequest));

/* ---------------- flujo legado (sin Supabase) ---------------- */
const canSubmitLegacy = computed(() => studentInput.value.trim().length > 0 && avatarInput.value.trim().length > 0);
function submitLegacy() {
  if (!canSubmitLegacy.value) return;
  setNames(studentInput.value, avatarInput.value);
  forceOpen.value = false;
}

/* ---------------- editar perfil ya ligado a una aula ---------------- */
const canSubmitEdit = computed(() => editReal.value.trim().length > 0 && editChar.value.trim().length > 0);
async function submitEdit() {
  if (!canSubmitEdit.value) return;
  setNames(editReal.value, editChar.value);
  if (supaOn && isLinkedToAula.value) await updateStudentProfile(editReal.value, editChar.value);
  forceOpen.value = false;
}

/* ---------------- registro (primera vez) ---------------- */
const canRegister = computed(
  () =>
    joinCode.value.trim().length > 0 &&
    realName.value.trim().length > 0 &&
    username.value.trim().length >= 3 &&
    characterName.value.trim().length > 0
);
async function submitRegister() {
  if (!canRegister.value || loading.value) return;
  loading.value = true;
  resetErrors();
  try {
    await registerStudent(joinCode.value, realName.value, username.value, characterName.value);
    forceOpen.value = false;
  } catch (e: any) {
    errorMsg.value = e?.message ?? "No se pudo registrar. Probá de nuevo.";
  } finally {
    loading.value = false;
  }
}

/* ---------------- "ya tengo usuario" ---------------- */
async function submitClaim() {
  if (!loginUsername.value.trim() || loading.value) return;
  loading.value = true;
  resetErrors();
  try {
    await claimStudent(loginUsername.value);
    forceOpen.value = false;
  } catch (e: any) {
    errorMsg.value = e?.message ?? "No se pudo iniciar sesión. Probá de nuevo.";
  } finally {
    loading.value = false;
  }
}

function switchMode(next: "register" | "claim") {
  mode.value = next;
  resetErrors();
}
</script>

<template>
  <div class="modal-backdrop" :class="{ show }">
    <div class="modal-box pxframe">
      <div class="eyebrow">// aula invertida — c++ debugging</div>

      <!-- Editar perfil de una identidad ya existente -->
      <template v-if="isEditing">
        <div class="modal-title">EDITAR PERFIL</div>
        <p class="modal-sub">Podés cambiar tu nombre o el de tu personaje cuando quieras.</p>

        <label class="field">
          <span>Tu nombre</span>
          <input v-model="editReal" type="text" maxlength="40" placeholder="Ej: Nico" @keyup.enter="submitEdit" />
        </label>
        <label class="field">
          <span>Nombre de tu personaje</span>
          <input
            v-model="editChar"
            type="text"
            maxlength="30"
            placeholder="Ej: Byte Bandit"
            @keyup.enter="submitEdit"
          />
        </label>

        <button class="btn" :disabled="!canSubmitEdit" @click="submitEdit">Guardar</button>
        <button class="btn ghost" @click="forceOpen = false">Cancelar</button>
      </template>

      <!-- Sin Supabase configurado: formulario simple de siempre -->
      <template v-else-if="!supaOn">
        <div class="modal-title">{{ isFirstTime ? "¿QUIÉN SOS?" : "EDITAR NOMBRES" }}</div>
        <p class="modal-sub">
          {{
            isFirstTime
              ? "Antes de arrancar, presentate a vos y a tu personaje."
              : "Podés cambiar tu nombre o el de tu personaje cuando quieras."
          }}
        </p>

        <label class="field">
          <span>Tu nombre</span>
          <input v-model="studentInput" type="text" maxlength="40" placeholder="Ej: Nico" @keyup.enter="submitLegacy" />
        </label>
        <label class="field">
          <span>Nombre de tu personaje</span>
          <input
            v-model="avatarInput"
            type="text"
            maxlength="30"
            placeholder="Ej: Byte Bandit"
            @keyup.enter="submitLegacy"
          />
        </label>

        <button class="btn" :disabled="!canSubmitLegacy" @click="submitLegacy">
          {{ isFirstTime ? "▶ Empezar misión" : "Guardar" }}
        </button>
        <button v-if="!isFirstTime" class="btn ghost" @click="forceOpen = false">Cancelar</button>
      </template>

      <!-- Con Supabase: registro con código de aula / login por username -->
      <template v-else>
        <div class="modal-title">{{ mode === "register" ? "¿QUIÉN SOS?" : "YA TENGO USUARIO" }}</div>
        <p class="modal-sub">
          {{
            mode === "register"
              ? "Pedile el código de aula a tu docente. El nombre de usuario es tu clave para volver a entrar, así que anotalo."
              : "Poné el nombre de usuario que elegiste la primera vez para recuperar tu progreso."
          }}
        </p>

        <div v-if="errorMsg" class="error-box">{{ errorMsg }}</div>

        <template v-if="mode === 'register'">
          <label class="field">
            <span>Código de aula</span>
            <input v-model="joinCode" type="text" maxlength="20" placeholder="Ej: PROG1-2026" />
          </label>
          <label class="field">
            <span>Tu nombre real</span>
            <input v-model="realName" type="text" maxlength="40" placeholder="Ej: Nicolás Rossofor" />
          </label>
          <label class="field">
            <span>Nombre de usuario (tu clave para volver a entrar)</span>
            <input v-model="username" type="text" maxlength="30" placeholder="Ej: byte_bandit_99" />
          </label>
          <label class="field">
            <span>Nombre de tu personaje</span>
            <input
              v-model="characterName"
              type="text"
              maxlength="30"
              placeholder="Ej: Byte Bandit"
              @keyup.enter="submitRegister"
            />
          </label>

          <button class="btn" :disabled="!canRegister || loading" @click="submitRegister">
            {{ loading ? "Conectando…" : "▶ Empezar misión" }}
          </button>
          <button class="btn link" :disabled="loading" @click="switchMode('claim')">
            ¿Ya tenés usuario? Entrá acá
          </button>
        </template>

        <template v-else>
          <label class="field">
            <span>Nombre de usuario</span>
            <input
              v-model="loginUsername"
              type="text"
              maxlength="30"
              placeholder="Ej: byte_bandit_99"
              @keyup.enter="submitClaim"
            />
          </label>

          <button class="btn" :disabled="!loginUsername.trim() || loading" @click="submitClaim">
            {{ loading ? "Conectando…" : "▶ Entrar" }}
          </button>
          <button class="btn link" :disabled="loading" @click="switchMode('register')">
            ¿Primera vez? Registrate
          </button>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(6, 4, 10, 0.9);
  z-index: 190;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
  overflow-y: auto;
  padding: 2rem 0;
}
.modal-backdrop.show {
  opacity: 1;
  pointer-events: auto;
}
.modal-box {
  background: var(--bg-panel);
  border: 3px solid var(--border-light);
  outline: 3px solid var(--border-dark);
  outline-offset: -6px;
  padding: 1.8rem 1.6rem;
  max-width: 360px;
  width: 90%;
  text-align: center;
  margin: auto;
}
.eyebrow {
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 0.95rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.modal-title {
  font-family: "Press Start 2P", monospace;
  color: var(--amber);
  font-size: 1.15rem;
  margin: 0.7rem 0 0.6rem;
  text-shadow: 2px 2px 0 var(--border-dark);
}
.modal-sub {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 1rem;
  margin: 0 0 1.2rem;
  line-height: 1.4;
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
.btn:active:not(:disabled) {
  transform: translateY(0) scale(0.96);
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.ghost {
  background: var(--bg-panel);
  color: var(--cream-dim);
  outline-color: var(--border-light);
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
.btn.link:hover:not(:disabled) {
  transform: none;
  opacity: 0.8;
}
</style>
