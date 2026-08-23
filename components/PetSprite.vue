<script setup lang="ts">
const props = defineProps<{ shape: "slime" | "drone" | "phoenix" | "dragon"; color: string }>();
</script>

<template>
  <div class="pet" :style="{ '--pet-color': props.color }">
    <!-- slime: cuerpo bajo y ancho, dos ojos -->
    <template v-if="props.shape === 'slime'">
      <div class="p body" />
      <div class="p eye e1" />
      <div class="p eye e2" />
    </template>

    <!-- drone: cubo con antena y luz -->
    <template v-else-if="props.shape === 'drone'">
      <div class="p antenna" />
      <div class="p tip" />
      <div class="p cube" />
      <div class="p eye e1 drone-eye" />
    </template>

    <!-- phoenix: cuerpo + dos alas + cresta -->
    <template v-else-if="props.shape === 'phoenix'">
      <div class="p crest" />
      <div class="p pbody" />
      <div class="p wing wl" />
      <div class="p wing wr" />
      <div class="p eye e1 phoenix-eye" />
    </template>

    <!-- dragon: cuerpo, cola, alas chicas, cuernos -->
    <template v-else-if="props.shape === 'dragon'">
      <div class="p horn hl" />
      <div class="p horn hr" />
      <div class="p dbody" />
      <div class="p tail" />
      <div class="p wing dwl" />
      <div class="p wing dwr" />
      <div class="p eye e1 dragon-eye" />
      <div class="p eye e2 dragon-eye" />
    </template>
  </div>
</template>

<style scoped>
.pet {
  position: relative;
  width: 34px;
  height: 30px;
  animation: petFloat 2s ease-in-out infinite;
}
@keyframes petFloat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
.p {
  position: absolute;
  background: var(--pet-color);
}
.eye {
  background: #0a0810 !important;
}

/* slime */
.body {
  left: 4px;
  top: 12px;
  width: 26px;
  height: 16px;
}
.e1 {
  left: 10px;
  top: 18px;
  width: 4px;
  height: 4px;
}
.e2 {
  left: 20px;
  top: 18px;
  width: 4px;
  height: 4px;
}

/* drone */
.antenna {
  left: 15px;
  top: 0;
  width: 3px;
  height: 8px;
}
.tip {
  left: 13px;
  top: -3px;
  width: 7px;
  height: 4px;
}
.cube {
  left: 5px;
  top: 8px;
  width: 24px;
  height: 18px;
}
.drone-eye {
  left: 13px;
  top: 15px;
  width: 8px;
  height: 4px;
}

/* phoenix */
.crest {
  left: 13px;
  top: 0;
  width: 8px;
  height: 6px;
}
.pbody {
  left: 9px;
  top: 8px;
  width: 16px;
  height: 18px;
}
.wing {
  top: 10px;
  width: 8px;
  height: 12px;
}
.wl {
  left: 0;
}
.wr {
  left: 26px;
}
.phoenix-eye {
  left: 14px;
  top: 14px;
  width: 4px;
  height: 4px;
}

/* dragon */
.horn {
  top: 0;
  width: 3px;
  height: 6px;
}
.hl {
  left: 8px;
}
.hr {
  left: 20px;
}
.dbody {
  left: 6px;
  top: 8px;
  width: 22px;
  height: 16px;
}
.tail {
  left: -4px;
  top: 16px;
  width: 10px;
  height: 5px;
}
.dwl {
  left: 0;
  top: 6px;
  width: 8px;
  height: 10px;
}
.dwr {
  left: 26px;
  top: 6px;
  width: 8px;
  height: 10px;
}
.dragon-eye {
  top: 13px;
  width: 4px;
  height: 4px;
}
.dragon-eye.e1 {
  left: 12px;
}
.dragon-eye.e2 {
  left: 20px;
}
</style>
