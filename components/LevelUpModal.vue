<script setup lang="ts">
import gsap from "gsap";
import { useEventBus } from "~/composables/useEventBus";

const show = ref(false);
const level = ref(1);
const title = ref("");

const flashRef = ref<HTMLElement | null>(null);
const boxRef = ref<HTMLElement | null>(null);
const bigRef = ref<HTMLElement | null>(null);

const bus = useEventBus();

function onLevelup(payload: { level: number; title: string }) {
  level.value = payload.level;
  title.value = payload.title;
  show.value = true;

  nextTick(() => {
    const tl = gsap.timeline();

    // flash blanco de pantalla completa
    if (flashRef.value) {
      tl.fromTo(
        flashRef.value,
        { opacity: 0.9 },
        { opacity: 0, duration: 0.45, ease: "power2.out" },
        0
      );
    }

    // el screen shake general del body
    tl.to(
      "body",
      { x: -6, duration: 0.05, repeat: 5, yoyo: true, ease: "none" },
      0
    ).set("body", { x: 0 });

    // la caja del modal entra con un pop elástico
    if (boxRef.value) {
      tl.fromTo(
        boxRef.value,
        { scale: 0.4, opacity: 0, rotate: -6 },
        { scale: 1, opacity: 1, rotate: 0, duration: 0.6, ease: "back.out(2.2)" },
        0.15
      );
    }

    // el número de nivel "late" con un rebote extra
    if (bigRef.value) {
      tl.fromTo(
        bigRef.value,
        { scale: 0 },
        { scale: 1.15, duration: 0.35, ease: "power3.out" },
        0.35
      ).to(bigRef.value, { scale: 1, duration: 0.25, ease: "bounce.out" }, 0.7);
    }
  });
}

onMounted(() => bus.on("levelup", onLevelup));
onUnmounted(() => bus.off("levelup", onLevelup));

function close() {
  if (boxRef.value) {
    gsap.to(boxRef.value, {
      scale: 0.7,
      opacity: 0,
      duration: 0.2,
      ease: "power1.in",
      onComplete: () => (show.value = false)
    });
  } else {
    show.value = false;
  }
}
</script>

<template>
  <div ref="flashRef" class="flash" />
  <div class="modal-backdrop" :class="{ show }" @click.self="close">
    <div ref="boxRef" class="modal-box pxframe">
      <div class="lvl-eyebrow">¡SUBISTE DE NIVEL!</div>
      <div ref="bigRef" class="lvl-big">NV. {{ level }}</div>
      <div class="lvl-title">{{ title }}</div>
      <button class="btn" @click="close">Continuar</button>
    </div>
  </div>
</template>

<style scoped>
.flash {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: #fff;
  opacity: 0;
  pointer-events: none;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(6, 4, 10, 0.82);
  z-index: 180;
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
  padding: 2rem 1.6rem;
  max-width: 340px;
  text-align: center;
}
.lvl-eyebrow {
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 1.1rem;
  letter-spacing: 0.1em;
}
.lvl-big {
  font-family: "Press Start 2P", monospace;
  color: var(--amber);
  font-size: 2.2rem;
  margin: 0.6rem 0;
  text-shadow: 3px 3px 0 var(--border-dark);
}
.lvl-title {
  font-family: "VT323", monospace;
  color: var(--cream);
  font-size: 1.3rem;
  margin-bottom: 1.2rem;
}
.btn {
  width: 100%;
  font-family: "Press Start 2P", monospace;
  font-size: 0.7rem;
  padding: 0.65rem 1rem;
  cursor: pointer;
  border: 2px solid var(--border-dark);
  outline: 2px solid var(--amber);
  outline-offset: -4px;
  background: var(--amber);
  color: #1a1509;
  font-weight: 700;
  transition: transform 0.12s;
}
.btn:hover {
  transform: translateY(-2px);
}
.btn:active {
  transform: translateY(0) scale(0.94);
}
@media (max-width: 520px) {
  .lvl-big {
    font-size: 1.7rem;
  }
}
</style>
