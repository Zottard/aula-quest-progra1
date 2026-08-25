<script setup lang="ts">
import { initProgressSync } from "~/composables/useProgressSync";

onMounted(() => {
  initProgressSync();
});
</script>

<template>
  <div>
    <div class="scanlines" />
    <div class="vignette" />
    <NuxtPage />
  </div>
</template>
