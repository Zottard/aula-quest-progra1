<script setup lang="ts">
import gsap from "gsap";
import { moduleFor, MODULES } from "~/data/modules";
import { useGameState } from "~/composables/useGameState";
import { useEventBus } from "~/composables/useEventBus";

const { state, exState, tierInfo, equippedWeapon, equippedArmor, typeEffectiveness, findExercise } = useGameState();
const bus = useEventBus();

const exercise = computed(() => findExercise(state.activeId)!);
const mod = computed(() => moduleFor(exercise.value.topic));
const enemySprite = computed(() => (exercise.value.boss ? "/sprites/enemy_boss.png" : mod.value.enemySprite));

const es = computed(() => exState(exercise.value.id));
// Los ejercicios de capítulo no tienen bugs[] (se resuelven todo-o-nada por
// casos de prueba), así que no hay "HP restante" fraccionario que mostrar:
// la barra queda llena hasta completar, y ahí baja a 0 de una.
const totalXp = computed(() => exercise.value.bugs.reduce((s, b) => s + b.xp, 0));
const remainingXp = computed(() =>
  exercise.value.bugs.reduce((s, b) => s + (es.value.solved[b.id] ? 0 : b.xp), 0)
);
const hpPct = computed(() => (totalXp.value === 0 ? 100 : Math.max(0, Math.round((remainingXp.value / totalXp.value) * 100))));
const defeated = computed(() => es.value.completed);

const effectiveness = computed(() => typeEffectiveness(exercise.value.topic));
const isSuperEffective = computed(() => effectiveness.value > 1);

const arenaRef = ref<HTMLElement | null>(null);
const playerSideRef = ref<HTMLElement | null>(null);
const enemyRef = ref<HTMLElement | null>(null);
const weaponFlyRef = ref<HTMLElement | null>(null);
const playerAttacking = ref(false);
const playerHurt = ref(false);
const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function showToast(msg: string) {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 1600);
}

/** Manda el sprite del arma volando desde el personaje hasta el enemigo
 * (medido en píxeles reales, no en % fijo, para que la trayectoria sea
 * correcta con cualquier ancho de pantalla) y recién dispara onHit() al
 * conectar — así el golpe del arma y la reacción del bicho quedan
 * causalmente juntos en vez de simultáneos y desconectados. */
function throwWeapon(onHit: () => void) {
  const weaponEl = weaponFlyRef.value;
  const arenaEl = arenaRef.value;
  const fromEl = playerSideRef.value;
  const toEl = enemyRef.value;
  if (!weaponEl || !arenaEl || !fromEl || !toEl) {
    onHit();
    return;
  }

  const arenaBox = arenaEl.getBoundingClientRect();
  const fromBox = fromEl.getBoundingClientRect();
  const toBox = toEl.getBoundingClientRect();
  const startX = fromBox.right - arenaBox.left - 12;
  const startY = fromBox.top + fromBox.height / 2 - arenaBox.top;
  const endX = toBox.left + toBox.width / 2 - arenaBox.left;
  const endY = toBox.top + toBox.height / 2 - arenaBox.top;

  gsap.killTweensOf(weaponEl);
  gsap.set(weaponEl, { x: startX, y: startY, opacity: 1, scale: 1, rotate: 0 });
  gsap.to(weaponEl, {
    x: endX,
    y: endY,
    rotate: 400,
    duration: 0.22,
    ease: "power2.in",
    onComplete: () => {
      onHit();
      gsap.to(weaponEl, { opacity: 0, scale: 0.5, duration: 0.18, delay: 0.05 });
    }
  });
}

function hitEnemy(superEffective: boolean) {
  playerAttacking.value = false;
  requestAnimationFrame(() => {
    playerAttacking.value = true;
    setTimeout(() => (playerAttacking.value = false), 380);
  });

  throwWeapon(() => {
    if (enemyRef.value) {
      gsap.killTweensOf(enemyRef.value);
      const tl = gsap.timeline();
      tl.to(enemyRef.value, { x: 8, duration: 0.05, repeat: 5, yoyo: true, ease: "none" })
        .set(enemyRef.value, { x: 0 })
        .fromTo(enemyRef.value, { filter: "brightness(3) saturate(0)" }, { filter: "brightness(1)", duration: 0.3 }, 0);
    }
    if (superEffective) showToast("⚡ ¡Es muy efectivo!");
  });
}

function missedAttack(exerciseId: string) {
  if (exerciseId !== exercise.value.id) return;
  playerHurt.value = false;
  requestAnimationFrame(() => {
    playerHurt.value = true;
    setTimeout(() => (playerHurt.value = false), 380);
  });
  showToast("El bug resiste... revisá el código.");
}

function onSolved(payload: { exerciseId: string; superEffective?: boolean }) {
  if (payload.exerciseId !== exercise.value.id) return;
  hitEnemy(!!payload.superEffective);
}
function onWrong(payload: { exerciseId: string }) {
  missedAttack(payload.exerciseId);
}
function onComplete(payload: { exerciseId: string }) {
  if (payload.exerciseId !== exercise.value.id || !enemyRef.value) return;
  gsap.to(enemyRef.value, { y: -20, opacity: 0, duration: 0.5, ease: "power1.in" });
}

onMounted(() => {
  bus.on("solved", onSolved);
  bus.on("wrong", onWrong);
  bus.on("complete", onComplete);
});
onUnmounted(() => {
  bus.off("solved", onSolved);
  bus.off("wrong", onWrong);
  bus.off("complete", onComplete);
});

watch(
  () => exercise.value.id,
  () => {
    if (enemyRef.value) gsap.set(enemyRef.value, { y: 0, opacity: 1, x: 0, filter: "none" });
    if (weaponFlyRef.value) gsap.set(weaponFlyRef.value, { opacity: 0 });
  }
);
</script>

<template>
  <div class="battle pxframe pxborder" :style="{ '--mod-color': mod.color }">
    <div class="battle-topbar">
      <span class="mod-chip">{{ mod.short }}</span>
      <span class="affinity" :class="{ hot: isSuperEffective }">
        {{ isSuperEffective ? "⚡ Tu arma es muy efectiva acá" : "Arma sin ventaja de tipo" }}
      </span>
    </div>

    <div ref="arenaRef" class="arena">
      <img ref="weaponFlyRef" :src="equippedWeapon.image" class="weapon-fly" alt="" />

      <div ref="playerSideRef" class="side player-side">
        <PixelAvatar
          :tier="tierInfo.tier"
          :leveling="false"
          :armor-image="equippedArmor?.image ?? null"
          :weapon-image="equippedWeapon.image"
          :weapon-glow="equippedWeapon.glow"
          :attacking="playerAttacking"
          :hurt="playerHurt"
        />
      </div>

      <div class="vs">VS</div>

      <div class="side enemy-side">
        <img ref="enemyRef" :src="enemySprite" class="enemy-sprite" :class="{ boss: exercise.boss }" alt="" />
        <div class="enemy-hp-track">
          <div class="enemy-hp-fill" :style="{ width: (defeated ? 0 : hpPct) + '%' }" />
        </div>
        <div class="enemy-label">{{ exercise.boss ? "JEFE" : mod.short.toUpperCase() }}</div>
      </div>
    </div>

    <transition name="toast-fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.battle {
  background: var(--bg-panel);
  padding: 0.8rem 1rem 1rem;
  position: relative;
  overflow: hidden;
}
.battle::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 20%, color-mix(in srgb, var(--mod-color) 18%, transparent), transparent 70%);
  pointer-events: none;
}
.battle-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  position: relative;
}
.mod-chip {
  font-family: "VT323", monospace;
  font-size: 1rem;
  color: var(--mod-color);
  border: 1px solid var(--mod-color);
  padding: 0.1rem 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.affinity {
  font-family: "VT323", monospace;
  font-size: 0.9rem;
  color: var(--cream-dim);
}
.affinity.hot {
  color: var(--amber);
}
.arena {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  position: relative;
}
.weapon-fly {
  position: absolute;
  top: 0;
  left: 0;
  width: 22px;
  height: 22px;
  opacity: 0;
  pointer-events: none;
  z-index: 4;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.5)) drop-shadow(0 0 6px var(--amber));
  will-change: transform;
}
.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
}
.vs {
  font-family: "Press Start 2P", monospace;
  font-size: 0.7rem;
  color: var(--cream-dim);
  flex: none;
}
.enemy-sprite {
  width: 72px;
  height: 72px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  filter: drop-shadow(3px 4px 0 rgba(0, 0, 0, 0.5));
  animation: idleBob 2.2s ease-in-out infinite;
}
.enemy-sprite.boss {
  width: 88px;
  height: 88px;
}
.enemy-hp-track {
  width: 90px;
  height: 8px;
  background: #0a0810;
  border: 1px solid var(--border-light);
  overflow: hidden;
}
.enemy-hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff5d5d, #ffb000);
  transition: width 0.5s cubic-bezier(0.2, 1, 0.3, 1);
}
.enemy-label {
  font-family: "VT323", monospace;
  font-size: 0.8rem;
  color: var(--cream-dim);
  letter-spacing: 0.05em;
}
.toast {
  position: absolute;
  left: 50%;
  bottom: 6px;
  transform: translateX(-50%);
  background: rgba(6, 4, 10, 0.9);
  border: 1px solid var(--amber);
  color: var(--amber);
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  padding: 0.25rem 0.7rem;
  white-space: nowrap;
  z-index: 5;
}
.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.25s;
}
.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}
</style>
