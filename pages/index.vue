<script setup lang="ts">
import { useGameState } from "~/composables/useGameState";

const { state, toggleMute } = useGameState();
</script>

<template>
  <div>
    <ConfettiLayer />
    <LevelUpModal />
    <OnboardingModal />

    <header class="hero">
      <button class="mute-btn" title="Silenciar sonido" @click="toggleMute">
        {{ state.muted ? "🔇" : "🔊" }}
      </button>
      <div class="eyebrow">// aula invertida — c++ debugging</div>
      <h1>C++ QUEST</h1>
      <p v-if="state.avatarName">
        {{ state.studentName }}, tu personaje <strong>{{ state.avatarName }}</strong> te está esperando.
        Cada bug que cazás vale experiencia — cada pista que pedís, un poco menos.
      </p>
      <p v-else>
        Miraste el material antes de clase. Ahora tu personaje sube de nivel arreglando el código
        que se rompió. Cada bug que cazás vale experiencia — cada pista que pedís, un poco menos.
      </p>
    </header>

    <div class="layout">
      <CharacterPanel />
      <section class="quest-panel">
        <BattleHUD />
        <QuestTabs />
        <QuestCard />
      </section>
    </div>

    <footer>C++ QUEST · progreso guardado en este navegador · hecho para aula invertida</footer>
  </div>
</template>

<style scoped>
.hero {
  padding: 2rem 1.2rem 1.2rem;
  border-bottom: 3px solid var(--border);
  text-align: center;
  position: relative;
}
.mute-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: var(--bg-panel);
  border: 2px solid var(--border-light);
  outline: 2px solid var(--border-dark);
  outline-offset: -4px;
  color: var(--cream);
  font-size: 1rem;
  width: 38px;
  height: 38px;
  cursor: pointer;
}
.mute-btn:active {
  transform: scale(0.9);
}
.eyebrow {
  font-family: "VT323", monospace;
  color: var(--cyan);
  font-size: 1rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
h1 {
  font-family: "Press Start 2P", monospace;
  font-size: clamp(1.2rem, 4.4vw, 2.1rem);
  color: var(--amber);
  text-shadow: 3px 3px 0 var(--border-dark), 0 0 22px rgba(255, 176, 0, 0.35);
  margin: 0.7rem 0 0.8rem;
  line-height: 1.6;
  letter-spacing: 0.02em;
}
.hero p {
  max-width: 640px;
  margin: 0 auto;
  color: var(--cream-dim);
  font-size: 0.95rem;
  line-height: 1.55;
}
.layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1.3rem;
  max-width: 1220px;
  margin: 1.5rem auto;
  padding: 0 1.2rem 3rem;
  align-items: start;
}
@media (max-width: 880px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.quest-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
footer {
  text-align: center;
  color: var(--cream-dim);
  font-size: 0.9rem;
  padding: 1.4rem 1rem 2.4rem;
  font-family: "VT323", monospace;
}
</style>
