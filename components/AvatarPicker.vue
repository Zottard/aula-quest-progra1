<script setup lang="ts">
import { AVATARS } from "~/data/avatars";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [id: string] }>();
</script>

<template>
  <div class="picker">
    <button
      v-for="av in AVATARS"
      :key="av.id"
      type="button"
      class="option"
      :class="{ on: props.modelValue === av.id }"
      :style="{ '--accent': av.accent }"
      :title="av.name"
      @click="emit('update:modelValue', av.id)"
    >
      <img :src="av.sprite" :alt="av.name" />
    </button>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: center;
}
.option {
  width: 52px;
  height: 52px;
  padding: 0;
  cursor: pointer;
  background: #0a0810;
  border: 2px solid var(--border-dark);
  outline: 1px solid var(--border-light);
  outline-offset: -2px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s;
}
.option:hover {
  transform: translateY(-2px);
}
.option.on {
  outline-color: var(--accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, #0a0810);
}
.option img {
  width: 40px;
  height: 40px;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
