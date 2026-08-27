<script setup lang="ts">
import { avatarById, auraForTier } from "~/data/avatars";

const props = defineProps<{
  /** Nivel del personaje. Ya NO decide qué cuerpo se dibuja: solo la
   * intensidad del aura/efectos. Ver data/avatars.ts. */
  tier: number;
  /** Avatar elegido por el alumno. Estable, no cambia con el nivel. */
  avatarId?: string | null;
  leveling: boolean;
  armorImage?: string | null;
  weaponImage?: string;
  weaponGlow?: boolean;
  attacking?: boolean;
  hurt?: boolean;
}>();

const avatar = computed(() => avatarById(props.avatarId));
const aura = computed(() => auraForTier(props.tier));

/** Posiciones fijas para las partículas orbitando: precalculadas por índice
 * para que no "salten" en cada re-render. */
const particles = computed(() =>
  Array.from({ length: aura.value.particles }, (_, i) => {
    const total = aura.value.particles;
    const angle = (i / total) * Math.PI * 2;
    return {
      id: i,
      x: 50 + Math.cos(angle) * 46,
      y: 50 + Math.sin(angle) * 46,
      delay: (i / total) * 3
    };
  })
);
</script>

<template>
  <div
    class="avatar-wrap"
    :class="{ leveling: props.leveling, attacking: props.attacking, hurt: props.hurt }"
    :style="{ '--glow': aura.glow ?? 'transparent', '--blur': aura.blur + 'px' }"
  >
    <div v-if="aura.glow" class="aura" />
    <div v-if="aura.ring" class="ring" />

    <span
      v-for="p in particles"
      :key="p.id"
      class="particle"
      :style="{ left: p.x + '%', top: p.y + '%', animationDelay: p.delay + 's' }"
    />

    <img :src="avatar.sprite" :key="avatar.sprite" class="sprite" :alt="avatar.name" />
    <img
      v-if="props.weaponImage"
      :src="props.weaponImage"
      class="held weapon-held"
      :class="{ glow: props.weaponGlow }"
      alt=""
    />
    <img v-if="props.armorImage" :src="props.armorImage" class="held armor-held" alt="" />
  </div>
</template>

<style scoped>
.avatar-wrap {
  position: relative;
  width: 96px;
  height: 96px;
  animation: idleBob 2.6s ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-wrap.leveling {
  animation: levelSpin 1s ease;
}
.avatar-wrap.attacking {
  animation: attackLunge 0.35s ease;
}
.avatar-wrap.hurt {
  animation: hurtShake 0.35s ease;
}
@keyframes attackLunge {
  0% { transform: translateX(0) rotate(0); }
  35% { transform: translateX(14px) rotate(-8deg); }
  100% { transform: translateX(0) rotate(0); }
}
@keyframes hurtShake {
  0%, 100% { transform: translateX(0); filter: none; }
  25% { transform: translateX(-6px); filter: brightness(1.8) saturate(0.4); }
  75% { transform: translateX(6px); filter: brightness(1.8) saturate(0.4); }
}

/* ---- progresión estética: cuanto más alto el nivel, más presencia ---- */
.aura {
  position: absolute;
  inset: -14px;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--glow) 38%, transparent), transparent 68%);
  filter: blur(calc(var(--blur) / 3));
  animation: auraPulse 3.2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes auraPulse {
  0%, 100% { opacity: 0.55; transform: scale(1); }
  50% { opacity: 0.95; transform: scale(1.08); }
}
.ring {
  position: absolute;
  bottom: 4px;
  left: 50%;
  transform: translateX(-50%);
  width: 62px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--glow) 60%, transparent);
  box-shadow: 0 0 var(--blur) color-mix(in srgb, var(--glow) 45%, transparent);
  pointer-events: none;
}
.particle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: var(--glow);
  box-shadow: 0 0 6px var(--glow);
  transform: translate(-50%, -50%);
  animation: particleFloat 3s ease-in-out infinite;
  pointer-events: none;
}
@keyframes particleFloat {
  0%, 100% { opacity: 0.25; transform: translate(-50%, -50%) scale(0.7); }
  50% { opacity: 1; transform: translate(-50%, -70%) scale(1.2); }
}

.sprite {
  position: relative;
  z-index: 1;
  width: 96px;
  height: 96px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(3px 4px 0 rgba(0, 0, 0, 0.5));
}
.held {
  position: absolute;
  z-index: 2;
  width: 26px;
  height: 26px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.5));
}
.weapon-held {
  right: -4px;
  bottom: 18px;
  transform: rotate(28deg);
}
.weapon-held.glow {
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.5)) drop-shadow(0 0 8px var(--amber));
  animation: swordGlow 1.8s ease-in-out infinite;
}
.armor-held {
  left: -2px;
  bottom: 14px;
  width: 22px;
  height: 22px;
}
@keyframes swordGlow {
  0%, 100% { filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.5)) drop-shadow(0 0 5px var(--amber)); }
  50% { filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.5)) drop-shadow(0 0 12px var(--amber)); }
}
</style>
