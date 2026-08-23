<script setup lang="ts">
import confetti from "canvas-confetti";
import { useEventBus } from "~/composables/useEventBus";

const COLORS = ["#ffb000", "#5eead4", "#ff3fa4", "#f5efe0"];

/** Explota confetti desde el centro de un elemento del DOM, con física real. */
function burstFromEl(el: Element | null, count = 24, spread = 70) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const originX = (r.left + r.width / 2) / window.innerWidth;
  const originY = (r.top + r.height / 2) / window.innerHeight;
  confetti({
    particleCount: count,
    spread,
    startVelocity: 32,
    gravity: 1.1,
    scalar: 0.9,
    colors: COLORS,
    origin: { x: originX, y: originY },
    shapes: ["square"],
    ticks: 160,
    disableForReducedMotion: true
  });
}

const bus = useEventBus();
function onSolved(payload: { exerciseId: string; bugId: string | null }) {
  const el = payload.bugId ? document.querySelector(`[data-bug="${payload.bugId}"]`) : null;
  burstFromEl(el ?? document.querySelector(".quest-title"), 22, 55);
}
function onComplete() {
  burstFromEl(document.querySelector(".quest-title"), 46, 80);
}
function onLevelup() {
  // ráfaga doble, más generosa, para el momento grande
  burstFromEl(document.querySelector(".avatar-stage"), 60, 100);
  setTimeout(() => burstFromEl(document.querySelector(".avatar-stage"), 40, 130), 180);
}

onMounted(() => {
  bus.on("solved", onSolved);
  bus.on("complete", onComplete);
  bus.on("levelup", onLevelup);
});
onUnmounted(() => {
  bus.off("solved", onSolved);
  bus.off("complete", onComplete);
  bus.off("levelup", onLevelup);
});
</script>

<template>
  <div />
</template>
