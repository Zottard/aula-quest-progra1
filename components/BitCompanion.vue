<script setup lang="ts">
import { useEventBus } from "~/composables/useEventBus";

const SPEECH: Record<string, string[]> = {
  idle: [
    "Elegí una misión y arranquemos.",
    "Leé el material previo antes de tocar el código.",
    "Recordá: cada pista te resta un poco de XP."
  ],
  wrong: [
    "Todavía hay algo roto ahí adentro. Seguí buscando.",
    "Mmm, no compila del todo bien. Revisá la lista de bugs.",
    "Casi. Fijate línea por línea."
  ],
  solved: ["¡Ahí está! Un bug menos.", "Nice catch. Seguimos.", "Eso es. Vas bien."],
  complete: ["¡Misión completa! Pasá a la siguiente.", "Código limpio. Buen trabajo.", "Esa la resolviste como un pro."],
  levelup: ["¡Subiste de nivel! Se nota la práctica.", "Nuevo rango desbloqueado."]
};

const message = ref(pick("idle"));

function pick(kind: string) {
  const arr = SPEECH[kind] ?? SPEECH.idle;
  return arr[Math.floor(Math.random() * arr.length)];
}

const bus = useEventBus();
function onEvent(kind: string) {
  message.value = pick(kind);
}
const handlers: [string, (p?: any) => void][] = [
  ["wrong", () => onEvent("wrong")],
  ["solved", () => onEvent("solved")],
  ["complete", () => onEvent("complete")],
  ["levelup", () => onEvent("levelup")]
];

onMounted(() => handlers.forEach(([e, h]) => bus.on(e, h)));
onUnmounted(() => handlers.forEach(([e, h]) => bus.off(e, h)));
</script>

<template>
  <div class="companion">
    <div class="bit">
      <div class="b b1" /><div class="b b2" /><div class="b b3" />
      <div class="b foot1" /><div class="b foot2" />
      <div class="b eye" /><div class="b eye2" />
    </div>
    <div class="speech">
      Hola, soy <b>BIT</b>. {{ message }}
    </div>
  </div>
</template>

<style scoped>
.companion {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin-bottom: 1rem;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  padding: 0.55rem;
}
.bit {
  width: 26px;
  height: 26px;
  position: relative;
  flex: none;
  animation: bitFloat 2.2s ease-in-out infinite;
}
.bit .b {
  position: absolute;
  background: var(--cyan);
}
.bit .b1 {
  left: 6px;
  top: 0;
  width: 14px;
  height: 14px;
}
.bit .b2 {
  left: 2px;
  top: 4px;
  width: 4px;
  height: 10px;
}
.bit .b3 {
  left: 20px;
  top: 4px;
  width: 4px;
  height: 10px;
}
.bit .eye {
  left: 9px;
  top: 5px;
  width: 3px;
  height: 3px;
  background: #0a0810;
}
.bit .eye2 {
  left: 15px;
  top: 5px;
  width: 3px;
  height: 3px;
  background: #0a0810;
}
.bit .foot1 {
  left: 6px;
  top: 14px;
  width: 5px;
  height: 4px;
}
.bit .foot2 {
  left: 16px;
  top: 14px;
  width: 5px;
  height: 4px;
}
.speech {
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  color: var(--cream-dim);
  line-height: 1.35;
}
.speech b {
  color: var(--amber);
}
</style>
