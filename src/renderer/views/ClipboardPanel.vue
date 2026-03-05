<template>
  <div class="clipboard-panel">
    <el-card class="info-card" shadow="never">
      <template #header>
        <div class="card-header">
          <el-icon><DocumentCopy /></el-icon>
          <span>剪贴板同步</span>
        </div>
      </template>
      <p class="desc">与其他设备实时同步剪贴板内容</p>
    </el-card>

    <div class="content-wrapper">
      <div class="devices-section">
        <el-empty v-if="devices.length === 0" description="未发现设备" :image-size="80" />
        <div v-else class="devices-list">
          <el-card
            v-for="device in devices"
            :key="device.id"
            class="device-card"
            shadow="hover"
          >
            <div class="device-content">
              <div class="device-icon">{{ getPlatformEmoji(device.platform) }}</div>
              <div class="device-info">
                <div class="device-name">{{ device.name }}</div>
                <div class="device-ip">{{ device.ip }}</div>
              </div>
              <el-button
                size="small"
                :type="isSyncing(device.id) ? 'danger' : 'primary'"
                @click="toggleSync(device)"
              >
                {{ isSyncing(device.id) ? "停止同步" : "开始同步" }}
              </el-button>
            </div>
          </el-card>
        </div>
      </div>

      <el-card class="log-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon><Clock /></el-icon>
            <span>同步日志</span>
          </div>
        </template>
        <div class="clipboard-log">
          <el-empty v-if="clipboardLogs.length === 0" description="暂无同步记录" :image-size="60" />
          <div v-else class="log-list">
            <div v-for="(log, index) in clipboardLogs" :key="index" class="log-entry">
              <div class="log-time">{{ formatTime(log.timestamp) }}</div>
              <div class="log-content">
                <div class="log-header">
                  <strong>{{ log.from }}</strong> 发送了{{ getContentTypeText(log.contentType) }}
                </div>
                <div v-if="log.preview" class="log-preview">{{ log.preview }}</div>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { DocumentCopy, Clock } from "@element-plus/icons-vue";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const devices = computed(() => store.devices);
const clipboardLogs = ref<any[]>([]);

const getPlatformEmoji = (platform: string) => {
  if (platform === "win32") return "🪟";
  if (platform === "darwin") return "🍎";
  if (platform === "linux") return "🐧";
  return "💻";
};

const isSyncing = (deviceId: string) => {
  return store.isSyncing(deviceId);
};

const toggleSync = async (device: any) => {
  const enabled = !isSyncing(device.id);

  await window.api.toggleClipboardSync({
    enabled,
    deviceId: device.id,
    deviceIp: device.ip,
    wsPort: device.clipboardPort,
  });

  store.toggleSyncDevice(device.id);

  if (enabled) {
    ElMessage.success(`已启用与 ${device.name} 的剪贴板同步`);
  } else {
    ElMessage.info(`已停止与 ${device.name} 的剪贴板同步`);
  }
};

const addClipboardLog = (info: any) => {
  const logEntry = {
    timestamp: Date.now(),
    from: info.from,
    contentType: info.contentType,
    preview: info.preview || "(无预览)",
  };

  clipboardLogs.value.unshift(logEntry);
  store.addClipboardLog(logEntry);

  // Limit to 50 entries
  if (clipboardLogs.value.length > 50) {
    clipboardLogs.value = clipboardLogs.value.slice(0, 50);
  }
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};

const getContentTypeText = (type: string) => {
  if (type === "text") return "文本";
  if (type === "image") return "图片";
  if (type === "files") return "文件";
  if (type === "folder") return "文件夹";
  return "内容";
};

let unsubscribeClipboard: (() => void) | null = null;
let unsubscribePeer: (() => void) | null = null;

onMounted(() => {
  // Load existing logs from store
  clipboardLogs.value = [...store.clipboardLogs];

  // Register event listeners and store unsubscribe functions
  unsubscribeClipboard = window.api.onClipboardSynced((info) => {
    // Only show notification if not already shown (prevent duplicates)
    const lastLog = clipboardLogs.value[0];
    const isDuplicate =
      lastLog &&
      lastLog.from === info.from &&
      lastLog.contentType === info.contentType &&
      Date.now() - lastLog.timestamp < 1000;

    if (!isDuplicate) {
      ElMessage.info(`收到剪贴板 来自 ${info.from}`);
      addClipboardLog(info);
    }
  });

  unsubscribePeer = window.api.onClipboardPeerStatus((status) => {
    if (status.connected) {
      store.syncingDevices.add(status.deviceId);
    } else {
      store.syncingDevices.delete(status.deviceId);
    }
  });
});

onUnmounted(() => {
  // Clean up event listeners
  if (unsubscribeClipboard) {
    unsubscribeClipboard();
    unsubscribeClipboard = null;
  }
  if (unsubscribePeer) {
    unsubscribePeer();
    unsubscribePeer = null;
  }
});
</script>

<style scoped>
.clipboard-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.devices-section {
  flex: 0 0 auto;
  max-height: 40%;
  overflow-y: auto;
}

.devices-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.info-card,
.log-card {
  border-radius: 8px;
  flex-shrink: 0;
}

.info-card :deep(.el-card__body) {
  padding: 14px;
}

.log-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.log-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.desc {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.device-card {
  border-radius: 8px;
}

.device-card :deep(.el-card__body) {
  padding: 12px;
}

.device-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.device-icon {
  font-size: 18px;
  line-height: 1;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  flex-shrink: 0;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
}

.device-ip {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  font-family: var(--font-mono, monospace);
}

.clipboard-log {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
}

.log-list {
  display: flex;
  flex-direction: column;
}

.log-entry {
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
  font-family: var(--font-mono, monospace);
}

.log-content {
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.5;
}

.log-header {
  margin-bottom: 4px;
}

.log-preview {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 6px 10px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  margin-top: 6px;
  word-break: break-all;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
</style>
