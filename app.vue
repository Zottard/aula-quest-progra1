<script setup lang="ts">
import { initProgressSync } from "~/composables/useProgressSync";
import { fetchChaptersForAula } from "~/composables/useChapters";
import { fetchOverridesForAula } from "~/composables/useExerciseOverrides";
import { useGameState } from "~/composables/useGameState";

const { state } = useGameState();

function loadAulaContent() {
  fetchChaptersForAula();
  // Los parches de las misiones fijas: sin esto el alumno vería el enunciado
  // de fábrica y se lo corregiría contra el output de fábrica.
  fetchOverridesForAula(state.aulaId);
}

onMounted(() => {
  initProgressSync();
  // Carga inicial (aula ya ligada de una sesión anterior) + cada vez que el
  // alumno recién se registra/reclama un usuario y aulaId pasa de null a algo.
  loadAulaContent();
  watch(() => state.aulaId, loadAulaContent);
});
</script>

<template>
  <div>
    <div class="scanlines" />
    <div class="vignette" />
    <NuxtPage />
  </div>
</template>
