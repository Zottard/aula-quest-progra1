<script setup lang="ts">
import { useGameState } from "~/composables/useGameState";
import { useEventBus } from "~/composables/useEventBus";

const { state, hasIdentity, setNames } = useGameState();
const bus = useEventBus();

const forceOpen = ref(false);
const studentInput = ref("");
const avatarInput = ref("");

const show = computed(() => !hasIdentity.value || forceOpen.value);

function openEditor() {
  studentInput.value = state.studentName;
  avatarInput.value = state.avatarName;
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

const canSubmit = computed(() => studentInput.value.trim().length > 0 && avatarInput.value.trim().length > 0);

function submit() {
  if (!canSubmit.value) return;
  setNames(studentInput.value, avatarInput.value);
  forceOpen.value = false;
}

const isFirstTime = computed(() => !hasIdentity.value);
</script>

<template>
  <div class="modal-backdrop" :class="{ show }">
    <div class="modal-box pxframe">
      <div class="eyebrow">// aula invertida — c++ debugging</div>
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
        <input v-model="studentInput" type="text" maxlength="40" placeholder="Ej: Nico" @keyup.enter="submit" />
      </label>

      <label class="field">
        <span>Nombre de tu personaje</span>
        <input v-model="avatarInput" type="text" maxlength="30" placeholder="Ej: Byte Bandit" @keyup.enter="submit" />
      </label>

      <button class="btn" :disabled="!canSubmit" @click="submit">
        {{ isFirstTime ? "▶ Empezar misión" : "Guardar" }}
      </button>
      <button v-if="!isFirstTime" class="btn ghost" @click="forceOpen = false">Cancelar</button>
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
</style>
