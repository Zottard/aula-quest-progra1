<script setup lang="ts">
import { useGameState } from "~/composables/useGameState";

const { SKILLS, hasSkill, availableSkillPoints, canUnlockSkill, unlockSkill } = useGameState();
</script>

<template>
  <details class="skill-panel">
    <summary>✨ Habilidades pasivas — {{ availableSkillPoints }} pto{{ availableSkillPoints === 1 ? "" : "s" }} disponible{{ availableSkillPoints === 1 ? "" : "s" }}</summary>

    <p class="hint">Ganás 1 punto por cada nivel. Se gastan una sola vez.</p>

    <div class="skill-list">
      <div
        v-for="skill in SKILLS"
        :key="skill.id"
        class="skill-node"
        :class="{ on: hasSkill(skill.id), locked: !hasSkill(skill.id) && !canUnlockSkill(skill.id) }"
      >
        <div class="skill-head">
          <span class="skill-name">{{ hasSkill(skill.id) ? "✔ " : "" }}{{ skill.name }}</span>
          <span class="skill-cost">{{ skill.cost }} pto{{ skill.cost > 1 ? "s" : "" }}</span>
        </div>
        <p class="skill-desc">{{ skill.description }}</p>
        <p v-if="skill.requires.length" class="skill-req">
          Requiere: {{ skill.requires.map((r) => SKILLS.find((s) => s.id === r)?.name).join(", ") }}
        </p>
        <button
          v-if="!hasSkill(skill.id)"
          class="skill-btn"
          :disabled="!canUnlockSkill(skill.id)"
          @click="unlockSkill(skill.id)"
        >
          Desbloquear
        </button>
      </div>
    </div>
  </details>
</template>

<style scoped>
.skill-panel {
  margin-bottom: 1rem;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  padding: 0.55rem 0.65rem;
}
.skill-panel summary {
  cursor: pointer;
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 1.05rem;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.hint {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.9rem;
  margin: 0.4rem 0 0.6rem;
}
.skill-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.skill-node {
  border: 1px solid var(--border-light);
  padding: 0.5rem 0.6rem;
}
.skill-node.on {
  border-color: var(--cyan);
  background: rgba(94, 234, 212, 0.06);
}
.skill-node.locked {
  opacity: 0.55;
}
.skill-head {
  display: flex;
  justify-content: space-between;
  font-family: "VT323", monospace;
  font-size: 1rem;
  color: var(--amber);
}
.skill-cost {
  color: var(--cream-dim);
}
.skill-desc {
  color: var(--cream-dim);
  font-family: "VT323", monospace;
  font-size: 0.92rem;
  margin: 0.25rem 0;
}
.skill-req {
  color: var(--magenta);
  font-family: "VT323", monospace;
  font-size: 0.82rem;
  margin: 0 0 0.3rem;
}
.skill-btn {
  font-family: "VT323", monospace;
  font-size: 0.9rem;
  background: var(--amber-dim);
  color: #1a1509;
  border: none;
  padding: 0.25rem 0.6rem;
  cursor: pointer;
}
.skill-btn:disabled {
  background: var(--border-light);
  color: var(--cream-dim);
  cursor: not-allowed;
}
</style>
