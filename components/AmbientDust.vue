<script setup lang="ts">
interface Particle {
  id: number;
  left: number;
  color: string;
  duration: number;
  delay: number;
}

const particles: Particle[] = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: 10 + Math.random() * 90,
  color: Math.random() > 0.5 ? "var(--cyan)" : "var(--amber)",
  duration: 3 + Math.random() * 3,
  delay: Math.random() * 4
}));
</script>

<template>
  <div
    v-for="p in particles"
    :key="p.id"
    class="dust"
    :style="{
      left: p.left + '%',
      background: p.color,
      animationDuration: p.duration + 's',
      animationDelay: p.delay + 's'
    }"
  />
</template>

<style scoped>
.dust {
  position: absolute;
  bottom: 6px;
  width: 3px;
  height: 3px;
  opacity: 0;
  animation-name: dustRise;
  animation-timing-function: ease-out;
  animation-iteration-count: infinite;
}
@keyframes dustRise {
  0% {
    transform: translateY(0);
    opacity: 0;
  }
  20% {
    transform: translateY(-20px);
    opacity: 0.7;
  }
  100% {
    transform: translateY(-140px);
    opacity: 0;
  }
}
</style>
