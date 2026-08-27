<script setup lang="ts">
import { useGameState } from "~/composables/useGameState";
import { moduleFor } from "~/data/modules";

// Antes esto era una lista de texto con un cuadradito de color al lado: no se
// veía el sprite real del ítem, no se entendía por qué un arma era mejor que
// otra, y los bloqueados eran solo una línea gris. Ahora es una grilla de
// tarjetas con el sprite grande, la afinidad de tipo coloreada, y un probador
// que muestra cómo te queda antes de equipar.
const { state, weapons, armors, pets, equipWeapon, equipArmor, equipPet, tierInfo } = useGameState();

type SlotKey = "weapon" | "armor" | "pet";
const slot = ref<SlotKey>("weapon");

const SLOTS: { key: SlotKey; label: string; icon: string }[] = [
  { key: "weapon", label: "Armas", icon: "⚔️" },
  { key: "armor", label: "Armaduras", icon: "🛡️" },
  { key: "pet", label: "Mascotas", icon: "🐾" }
];

const items = computed(() => (slot.value === "weapon" ? weapons.value : slot.value === "armor" ? armors.value : pets.value));

const equippedId = computed(() =>
  slot.value === "weapon"
    ? state.equipment.weaponId
    : slot.value === "armor"
      ? state.equipment.armorId
      : state.equipment.petId
);

/** Ítem bajo el mouse: alimenta el probador de arriba. Si no hay ninguno,
 * el probador muestra lo que está equipado ahora. */
const hovered = ref<string | null>(null);
const previewItem = computed(() => items.value.find((i) => i.id === (hovered.value ?? equippedId.value)) ?? null);

/** El preview del personaje solo cambia el slot que se está mirando; los
 * otros dos quedan como están equipados, para que se vea el conjunto. */
const previewWeapon = computed(() => {
  if (slot.value !== "weapon") return weapons.value.find((w) => w.id === state.equipment.weaponId) ?? null;
  return weapons.value.find((w) => w.id === (hovered.value ?? state.equipment.weaponId)) ?? null;
});
const previewArmor = computed(() => {
  if (slot.value !== "armor") return armors.value.find((a) => a.id === state.equipment.armorId) ?? null;
  return armors.value.find((a) => a.id === (hovered.value ?? state.equipment.armorId)) ?? null;
});

function pick(id: string) {
  const item = items.value.find((i) => i.id === id);
  if (!item || !item.unlocked) return;
  if (slot.value === "weapon") equipWeapon(id);
  else if (slot.value === "armor") equipArmor(id === state.equipment.armorId ? null : id);
  else equipPet(id);
}

function affinityLabel(item: any): { text: string; color: string } | null {
  if (slot.value !== "weapon" || !item?.affinity) return null;
  if (item.affinity === "universal") return { text: "Efectiva contra todo", color: "var(--amber)" };
  const mod = moduleFor(item.affinity);
  return { text: `Muy efectiva vs ${mod.short}`, color: mod.color };
}
</script>

<template>
  <details class="equip-panel" open>
    <summary>⚔️ Equipo</summary>

    <!-- probador -->
    <div class="preview">
      <div class="preview-figure">
        <PixelAvatar
          :tier="tierInfo.tier"
          :avatar-id="state.avatarId"
          :leveling="false"
          :armor-image="previewArmor?.image ?? null"
          :weapon-image="previewWeapon?.image"
          :weapon-glow="previewWeapon?.glow"
        />
      </div>
      <div class="preview-info">
        <div class="preview-name" :style="{ color: previewItem?.unlocked ? 'var(--amber)' : 'var(--cream-dim)' }">
          {{ previewItem?.name ?? "Sin equipar" }}
        </div>
        <div v-if="affinityLabel(previewItem)" class="preview-affinity" :style="{ color: affinityLabel(previewItem)!.color }">
          ⚡ {{ affinityLabel(previewItem)!.text }}
        </div>
        <p class="preview-desc">
          {{ previewItem?.unlocked ? previewItem?.description : `🔒 Se desbloquea: ${previewItem?.unlockLabel}` }}
        </p>
        <div v-if="hovered && previewItem?.unlocked && hovered !== equippedId" class="preview-cta">
          click para equipar
        </div>
      </div>
    </div>

    <!-- pestañas de slot -->
    <div class="tabs">
      <button
        v-for="s in SLOTS"
        :key="s.key"
        class="tab"
        :class="{ on: slot === s.key }"
        @click="slot = s.key; hovered = null"
      >
        {{ s.icon }} {{ s.label }}
      </button>
    </div>

    <!-- grilla -->
    <div class="grid" @mouseleave="hovered = null">
      <button
        v-for="item in items"
        :key="item.id"
        class="card"
        :class="{ locked: !item.unlocked, on: item.id === equippedId }"
        :style="{ '--card-accent': item.color }"
        :disabled="!item.unlocked"
        :title="item.unlocked ? item.name : `🔒 ${item.unlockLabel}`"
        @mouseenter="hovered = item.id"
        @focus="hovered = item.id"
        @click="pick(item.id)"
      >
        <span class="card-art">
          <img v-if="item.image" :src="item.image" alt="" :class="{ silhouette: !item.unlocked }" />
          <span v-else class="blob" :style="{ background: item.unlocked ? item.color : '#2a2336' }" />
          <span v-if="!item.unlocked" class="lock">🔒</span>
        </span>
        <span class="card-name">{{ item.unlocked ? item.name : item.unlockLabel }}</span>
        <span v-if="item.id === equippedId" class="card-badge">equipado</span>
      </button>
    </div>
  </details>
</template>

<style scoped>
.equip-panel {
  margin-bottom: 1rem;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  padding: 0.55rem 0.65rem 0.8rem;
}
.equip-panel summary {
  cursor: pointer;
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 1.05rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
}

/* ---------------- probador ---------------- */
.preview {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  background: linear-gradient(180deg, #120e1b, #0a0810);
  border: 1px solid var(--border-dark);
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.7rem;
  min-height: 104px;
}
.preview-figure {
  flex: none;
  transform: scale(0.82);
  transform-origin: center;
}
.preview-info {
  flex: 1;
  min-width: 0;
}
.preview-name {
  font-family: "VT323", monospace;
  font-size: 1.15rem;
  line-height: 1.2;
}
.preview-affinity {
  font-family: "VT323", monospace;
  font-size: 0.88rem;
  margin-top: 0.15rem;
}
.preview-desc {
  font-family: "VT323", monospace;
  font-size: 0.9rem;
  color: var(--cream-dim);
  line-height: 1.35;
  margin: 0.3rem 0 0;
}
.preview-cta {
  font-family: "VT323", monospace;
  font-size: 0.82rem;
  color: var(--cyan);
  margin-top: 0.3rem;
}

/* ---------------- pestañas ---------------- */
.tabs {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 0.6rem;
}
.tab {
  flex: 1;
  background: none;
  border: 1px solid var(--border-light);
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.92rem;
  padding: 0.3rem 0.2rem;
  cursor: pointer;
  white-space: nowrap;
}
.tab.on {
  border-color: var(--amber);
  color: var(--amber);
  background: rgba(255, 176, 0, 0.1);
}

/* ---------------- grilla ---------------- */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 0.4rem;
}
.card {
  position: relative;
  background: #14101c;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  padding: 0.4rem 0.25rem 0.3rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  transition: transform 0.12s;
}
.card:hover:not(.locked) {
  transform: translateY(-3px);
  outline-color: var(--card-accent);
}
.card.on {
  outline-color: var(--cyan);
  background: rgba(94, 234, 212, 0.09);
}
.card.locked {
  cursor: not-allowed;
  opacity: 0.75;
}
.card-art {
  position: relative;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-art img {
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
/* Los bloqueados se muestran en silueta: se ve QUÉ te falta, no un hueco. */
.card-art img.silhouette {
  filter: brightness(0) saturate(100%) opacity(0.45);
}
.blob {
  width: 22px;
  height: 22px;
  border-radius: 4px;
}
.lock {
  position: absolute;
  right: -2px;
  bottom: -2px;
  font-size: 0.72rem;
}
.card-name {
  font-family: "VT323", monospace;
  font-size: 0.76rem;
  color: var(--cream-dim);
  text-align: center;
  line-height: 1.15;
  word-break: break-word;
}
.card.on .card-name {
  color: var(--cyan);
}
.card-badge {
  position: absolute;
  top: -1px;
  left: -1px;
  background: var(--cyan);
  color: #06202c;
  font-family: "VT323", monospace;
  font-size: 0.62rem;
  padding: 0 0.22rem;
  letter-spacing: 0.02em;
}
</style>
