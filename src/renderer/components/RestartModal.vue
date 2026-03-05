<template>
  <div v-if="visible" class="del-modal">
    <div class="del-modal-overlay" @click="cancel"></div>
    <div class="del-modal-box">
      <div class="del-modal-icon">🔄</div>
      <h4 class="del-modal-title">{{ title }}</h4>
      <p class="del-modal-desc">{{ message }}</p>
      <div class="del-modal-actions">
        <button @click="cancel" class="btn btn-ghost">稍后</button>
        <button @click="confirm" class="btn btn-primary">立即重启</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const visible = ref(false);
const title = ref("");
const message = ref("");

const show = (t: string, m: string) => {
  title.value = t;
  message.value = m;
  visible.value = true;
};

const confirm = async () => {
  await window.api.restartApp();
  visible.value = false;
};

const cancel = () => {
  visible.value = false;
};

defineExpose({ show });
</script>
