<script setup lang="ts">
import { useGameState } from "~/composables/useGameState";
import { useEventBus } from "~/composables/useEventBus";

const {
  state,
  level,
  xpIntoLevel,
  tierInfo,
  bugsFixed,
  questsDone,
  noHintQuestDone,
  resetProgress,
  equippedWeapon,
  equippedArmor,
  equippedPet,
  XP_PER_LEVEL
} = useGameState();

const badges = computed(() => [
  { label: "Primer bug cazado", on: bugsFixed.value >= 1 },
  { label: "5 bugs cazados", on: bugsFixed.value >= 5 },
  { label: "Sin pistas", on: noHintQuestDone.value },
  { label: "Debugger perfecto", on: questsDone.value === 7 }
]);

const leveling = ref(false);
const bus = useEventBus();
function onLevelup() {
  leveling.value = false;
  requestAnimationFrame(() => {
    leveling.value = true;
    setTimeout(() => (leveling.value = false), 1000);
  });
}
onMounted(() => bus.on("levelup", onLevelup));
onUnmounted(() => bus.off("levelup", onLevelup));

function handleReset() {
  if (confirm("¿Reiniciar todo el progreso del personaje? Esto no se puede deshacer.")) {
    resetProgress();
  }
}
</script>

<template>
  <aside class="char-panel pxframe pxborder">
    <div class="avatar-stage pxframe">
      <AmbientDust />
      <div class="pet-slot">
        <PetSprite :shape="equippedPet.shape" :color="equippedPet.color" />
      </div>
      <PixelAvatar
        :tier="tierInfo.tier"
        :avatar-id="state.avatarId"
        :leveling="leveling"
        :armor-image="equippedArmor?.image ?? null"
        :weapon-image="equippedWeapon.image"
        :weapon-glow="equippedWeapon.glow"
      />
    </div>

    <div class="avatar-name-row">
      <span class="avatar-name">{{ state.avatarName || "Sin nombre" }}</span>
      <button class="edit-btn" title="Editar nombres" @click="bus.emit('openOnboarding')">✎</button>
    </div>
    <div class="player-name">jugador: {{ state.studentName || "—" }}</div>

    <div class="char-name">NIVEL {{ level }}</div>
    <div class="char-title">{{ tierInfo.title }}</div>

    <div class="xp-row"><span>XP</span><span>{{ xpIntoLevel }} / {{ XP_PER_LEVEL }}</span></div>
    <div class="xp-bar-track">
      <div class="xp-bar-fill" :style="{ width: (xpIntoLevel / XP_PER_LEVEL) * 100 + '%' }" />
    </div>

    <div class="stat-grid">
      <div class="stat-box"><span class="n">{{ bugsFixed }}</span><span class="l">bugs cazados</span></div>
      <div class="stat-box"><span class="n">{{ questsDone }} / 7</span><span class="l">misiones completas</span></div>
    </div>

    <div class="badges">
      <span
        v-for="b in badges"
        :key="b.label"
        v-motion
        :initial="b.on ? { scale: 0.3, opacity: 0.6 } : {}"
        :enter="b.on ? { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 14 } } : {}"
        class="badge"
        :class="{ on: b.on }"
        >{{ b.label }}</span
      >
    </div>

    <EquipmentPanel />
    <SkillTree />

    <BitCompanion />

    <button v-motion :tapped="{ scale: 0.96 }" class="reset-btn" @click="handleReset">
      Reiniciar progreso del personaje
    </button>
  </aside>
</template>

<style scoped>
.char-panel {
  background: var(--bg-panel);
  padding: 1.2rem;
}
@media (min-width: 881px) {
  .char-panel {
    position: sticky;
    top: 1rem;
  }
}
.avatar-stage {
  position: relative;
  height: 190px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  margin-bottom: 0.9rem;
  overflow: hidden;
  background: radial-gradient(circle at 50% 85%, rgba(255, 176, 0, 0.14), transparent 60%),
    linear-gradient(180deg, #0a0810, #171225);
}
.pet-slot {
  position: absolute;
  right: 18px;
  bottom: 14px;
  z-index: 2;
}
.avatar-name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin-top: 0.2rem;
}
.avatar-name {
  font-family: "VT323", monospace;
  color: var(--magenta);
  font-size: 1.25rem;
  letter-spacing: 0.02em;
}
.edit-btn {
  background: none;
  border: 1px solid var(--border-light);
  color: var(--cream-dim);
  font-size: 0.7rem;
  width: 20px;
  height: 20px;
  line-height: 1;
  cursor: pointer;
  flex: none;
}
.edit-btn:hover {
  border-color: var(--amber);
  color: var(--amber);
}
.player-name {
  text-align: center;
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.9rem;
  margin-bottom: 0.6rem;
}
.char-name {
  text-align: center;
  font-family: "Press Start 2P", monospace;
  color: var(--amber);
  font-size: 0.85rem;
  margin-bottom: 0.35rem;
  letter-spacing: 0.02em;
}
.char-title {
  text-align: center;
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 1.05rem;
  margin-bottom: 1rem;
}
.xp-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  margin-bottom: 0.25rem;
}
.xp-bar-track {
  height: 14px;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  margin-bottom: 1rem;
  position: relative;
  overflow: hidden;
}
.xp-bar-fill {
  height: 100%;
  background: repeating-linear-gradient(90deg, var(--amber) 0 6px, var(--amber-dim) 6px 8px);
  width: 0%;
  transition: width 0.7s cubic-bezier(0.2, 1, 0.3, 1);
  position: relative;
}
.xp-bar-fill::after {
  content: "";
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  background: #fff;
  opacity: 0.6;
  filter: blur(2px);
}
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.stat-box {
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  padding: 0.5rem 0.6rem;
}
.stat-box .n {
  font-family: "Press Start 2P", monospace;
  color: var(--cyan);
  font-size: 1.05rem;
  display: block;
  margin-bottom: 0.15rem;
}
.stat-box .l {
  font-size: 0.9rem;
  color: var(--cream-dim);
  font-family: "VT323", monospace;
}
.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.badge {
  font-size: 0.85rem;
  font-family: "VT323", monospace;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--amber-dim);
  color: var(--cream-dim);
}
.badge.on {
  border-color: var(--amber);
  color: var(--amber);
  background: rgba(255, 176, 0, 0.1);
  animation: badgeGlow 2s ease-in-out infinite;
}
.reset-btn {
  width: 100%;
  background: none;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.reset-btn:hover {
  border-color: var(--red);
}
.reset-btn:active {
  transform: scale(0.97);
}
</style>
