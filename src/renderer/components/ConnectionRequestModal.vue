<template>
  <el-dialog
    v-model="visible"
    title="连接请求"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
  >
    <div class="connection-request-content">
      <el-icon class="request-icon" :size="48" color="#409EFF">
        <Link />
      </el-icon>
      <p class="request-text">
        <strong>{{ request?.fromName }}</strong> ({{ request?.fromIp }}) 请求连接
      </p>
    </div>
    <template #footer>
      <el-button @click="reject">拒绝</el-button>
      <el-button type="primary" @click="approve">同意连接</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Link } from "@element-plus/icons-vue";

const visible = ref(false);
const request = ref<any>(null);

const show = (req: any) => {
  request.value = req;
  visible.value = true;
};

onMounted(() => {
  window.api.onConnectionRequest((req) => {
    show(req);
  });
});

const approve = async () => {
  if (request.value) {
    await window.api.approveConnection(request.value.requestId);
    visible.value = false;
    request.value = null;
  }
};

const reject = async () => {
  if (request.value) {
    await window.api.rejectConnection(request.value.requestId);
    visible.value = false;
    request.value = null;
  }
};

defineExpose({ show });
</script>

<style scoped>
.connection-request-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px 0;
}

.request-icon {
  margin-bottom: 0;
}

.request-text {
  text-align: center;
  font-size: 14px;
  color: var(--el-text-color-primary);
  margin: 0;
  line-height: 1.6;
}
</style>
