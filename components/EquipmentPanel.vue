<script setup lang="ts">
import { useGameState } from "~/composables/useGameState";

const { state, weapons, armors, pets, equipWeapon, equipArmor, equipPet } = useGameState();

const openSlot = ref<"weapon" | "armor" | "pet" | null>(null);
function toggleSlot(slot: "weapon" | "armor" | "pet") {
  openSlot.value = openSlot.value === slot ? null : slot;
}
</script>

<template>
  <details class="equip-panel">
    <summary>⚔️ Equipo</summary>

    <div class="slot-row" @click="toggleSlot('weapon')">
      <span class="slot-label">Arma</span>
      <span class="slot-value">{{ weapons.find((w) => w.id === state.equipment.weaponId)?.name }}</span>
    </div>
    <div v-if="openSlot === 'weapon'" class="chip-grid">
      <button
        v-for="w in weapons"
        :key="w.id"
        class="chip"
        :class="{ active: state.equipment.weaponId === w.id, locked: !w.unlocked }"
        :disabled="!w.unlocked"
        :title="w.unlocked ? w.description : `Se desbloquea en: ${w.unlockLabel}`"
        @click="equipWeapon(w.id)"
      >
        <img v-if="w.image" :src="w.image" class="icon-sprite" alt="" />
        <span v-else class="swatch" :style="{ background: w.color }" />
        {{ w.unlocked ? w.name : "🔒 " + w.unlockLabel }}
      </button>
    </div>

    <div class="slot-row" @click="toggleSlot('armor')">
      <span class="slot-label">Armadura</span>
      <span class="slot-value">{{ armors.find((a) => a.id === state.equipment.armorId)?.name ?? "Sin equipar" }}</span>
    </div>
    <div v-if="openSlot === 'armor'" class="chip-grid">
      <button
        class="chip"
        :class="{ active: state.equipment.armorId === null }"
        @click="equipArmor(null)"
      >
        Sin equipar
      </button>
      <button
        v-for="a in armors"
        :key="a.id"
        class="chip"
        :class="{ active: state.equipment.armorId === a.id, locked: !a.unlocked }"
        :disabled="!a.unlocked"
        :title="a.unlocked ? a.description : `Se desbloquea en: ${a.unlockLabel}`"
        @click="equipArmor(a.id)"
      >
        <img v-if="a.image" :src="a.image" class="icon-sprite" alt="" />
        <span v-else class="swatch" :style="{ background: a.color }" />
        {{ a.unlocked ? a.name : "🔒 " + a.unlockLabel }}
      </button>
    </div>

    <div class="slot-row" @click="toggleSlot('pet')">
      <span class="slot-label">Mascota</span>
      <span class="slot-value">{{ pets.find((p) => p.id === state.equipment.petId)?.name }}</span>
    </div>
    <div v-if="openSlot === 'pet'" class="chip-grid">
      <button
        v-for="p in pets"
        :key="p.id"
        class="chip"
        :class="{ active: state.equipment.petId === p.id, locked: !p.unlocked }"
        :disabled="!p.unlocked"
        :title="p.unlocked ? p.description : `Se desbloquea: ${p.unlockLabel}`"
        @click="equipPet(p.id)"
      >
        <span class="swatch" :style="{ background: p.color }" />
        {{ p.unlocked ? p.name : "🔒 " + p.unlockLabel }}
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
  padding: 0.55rem 0.65rem;
}
.equip-panel summary {
  cursor: pointer;
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 1.05rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.slot-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: "VT323", monospace;
  font-size: 0.95rem;
  padding: 0.4rem 0.1rem;
  cursor: pointer;
  border-bottom: 1px dashed #241d33;
}
.slot-label {
  color: var(--cream-dim);
}
.slot-value {
  color: var(--amber);
}
.chip-grid {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0 0.3rem;
}
.chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: "VT323", monospace;
  font-size: 0.9rem;
  background: none;
  border: 1px solid var(--border-light);
  color: var(--cream-dim);
  padding: 0.3rem 0.5rem;
  text-align: left;
  cursor: pointer;
}
.chip.active {
  border-color: var(--amber);
  color: var(--amber);
  background: rgba(255, 176, 0, 0.08);
}
.chip.locked {
  opacity: 0.45;
  cursor: not-allowed;
}
.icon-sprite {
  width: 16px;
  height: 16px;
  flex: none;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
.swatch {
  width: 10px;
  height: 10px;
  flex: none;
  display: inline-block;
}
</style>
