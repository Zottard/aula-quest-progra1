<script setup lang="ts">
const props = defineProps<{
  tier: number;
  leveling: boolean;
  armorImage?: string | null;
  weaponImage?: string;
  weaponGlow?: boolean;
  attacking?: boolean;
  hurt?: boolean;
}>();

const TIER_SPRITE: Record<number, string> = {
  1: "/sprites/avatar_tier1.png",
  2: "/sprites/avatar_tier2.png",
  3: "/sprites/avatar_tier3.png",
  4: "/sprites/avatar_tier4.png",
  5: "/sprites/avatar_tier5.png"
};
const sprite = computed(() => TIER_SPRITE[props.tier] ?? TIER_SPRITE[1]);
</script>

<template>
  <div
    class="avatar-wrap"
    :class="{ leveling: props.leveling, attacking: props.attacking, hurt: props.hurt }"
  >
    <div class="aura" :style="{ opacity: props.tier >= 4 ? 1 : 0 }" />
    <img :src="sprite" :key="sprite" class="sprite" alt="" />
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
.aura {
  position: absolute;
  inset: -20px;
  border-radius: 50%;
  transition: opacity 0.5s;
  background: radial-gradient(circle, rgba(94, 234, 212, 0.3), transparent 65%);
}
.sprite {
  position: relative;
  width: 96px;
  height: 96px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(3px 4px 0 rgba(0, 0, 0, 0.5));
}
.held {
  position: absolute;
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
