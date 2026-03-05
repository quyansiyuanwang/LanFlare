<template>
  <aside class="sidebar">
    <el-card class="device-info-card" shadow="never">
      <div class="info-row">
        <span class="info-label">设备名称</span>
        <span class="info-value">{{ deviceInfo?.name || "加载中..." }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">本机 IP</span>
        <span class="info-value">{{ deviceInfo?.ip || "加载中..." }}</span>
      </div>
      <div class="info-row clickable" @click="copyWebUrl">
        <span class="info-label">浏览器收发</span>
        <el-tooltip content="点击复制" placement="top">
          <span class="info-value web-url">{{ deviceInfo?.webUrl || "加载中..." }}</span>
        </el-tooltip>
      </div>
    </el-card>

    <div class="device-section">
      <h3>在线设备</h3>
      <el-scrollbar height="calc(100vh - 300px)">
        <el-empty v-if="devices.length === 0" description="未发现设备" :image-size="80" />

        <el-card
          v-for="device in devices"
          :key="device.id"
          class="device-card"
          :class="{ selected: selectedDevice?.id === device.id }"
          shadow="hover"
          @click="selectDevice(device)"
        >
          <div class="device-content">
            <div class="device-icon">{{ getPlatformEmoji(device.platform) }}</div>
            <div class="device-info">
              <div class="device-name">{{ device.name }}</div>
              <div class="device-ip">{{ device.ip }}</div>
            </div>
            <el-icon v-if="selectedDevice?.id === device.id" class="selected-icon" color="#409EFF">
              <Check />
            </el-icon>
          </div>
        </el-card>
      </el-scrollbar>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import { Check } from "@element-plus/icons-vue";
import { useAppStore } from "../stores/app";

const store = useAppStore();

const devices = computed(() => store.devices);
const selectedDevice = computed(() => store.selectedDevice);
const deviceInfo = computed(() => store.deviceInfo);

const getPlatformEmoji = (platform: string) => {
  if (platform === "win32") return "🪟";
  if (platform === "darwin") return "🍎";
  if (platform === "linux") return "🐧";
  return "💻";
};

const selectDevice = async (device: any) => {
  // If clicking the same device, deselect it
  if (selectedDevice.value?.id === device.id) {
    store.setSelectedDevice(null);
    ElMessage.info(`已断开与 ${device.name} 的连接`);
    return;
  }

  // Otherwise, request connection
  const result = await window.api.requestConnection(device.ip, device.id);
  if (result.approved) {
    store.setSelectedDevice(device);
    ElMessage.success(`已连接到 ${device.name}`);
  } else {
    ElMessage.error(result.error || "连接被拒绝");
  }
};

const copyWebUrl = () => {
  if (deviceInfo.value?.webUrl) {
    navigator.clipboard.writeText(deviceInfo.value.webUrl);
    ElMessage.success("已复制到剪贴板");
  }
};
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex-shrink: 0;
  min-width: 200px;
  max-width: 280px;
}

.device-info-card {
  border-radius: 8px;
}

.device-info-card :deep(.el-card__body) {
  padding: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.info-row.clickable {
  cursor: pointer;
}

.info-row.clickable:hover .web-url {
  color: var(--el-color-primary);
}

.info-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.info-value {
  font-size: 12px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

.web-url {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
}

.device-section h3 {
  font-size: 11px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.device-card {
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 8px;
}

.device-card :deep(.el-card__body) {
  padding: 8px 10px;
}

.device-card.selected {
  border-left: 3px solid var(--el-color-primary);
  background: var(--el-fill-color);
}

.device-card.selected :deep(.el-card__body) {
  padding-left: 7px;
}

.device-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.device-icon {
  font-size: 18px;
  line-height: 1;
  width: 32px;
  height: 32px;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.device-ip {
  font-size: 10px;
  color: var(--el-text-color-secondary);
  font-family: var(--font-mono, monospace);
  line-height: 1.3;
}

.selected-icon {
  font-size: 16px;
}
</style>
