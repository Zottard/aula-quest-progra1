<script setup lang="ts">
import { initProgressSync } from "~/composables/useProgressSync";
import { fetchChaptersForAula } from "~/composables/useChapters";
import { useGameState } from "~/composables/useGameState";

const { state } = useGameState();

onMounted(() => {
  initProgressSync();
  // Carga inicial (aula ya ligada de una sesión anterior) + cada vez que el
  // alumno recién se registra/reclama un usuario y aulaId pasa de null a algo.
  fetchChaptersForAula();
  watch(() => state.aulaId, () => fetchChaptersForAula());
});
</script>

<template>
  <div>
    <div class="scanlines" />
    <div class="vignette" />
    <NuxtPage />
  </div>
</template>
