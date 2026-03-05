<template>
  <div class="send-panel">
    <!-- Current Target Display -->
    <el-alert
      v-if="selectedDevice || store.webTargetUrl"
      :title="currentTargetText"
      type="info"
      closable
      show-icon
      @close="clearTarget"
    />

    <el-alert
      v-else
      title="请先选择左侧设备或输入浏览器接收地址"
      type="warning"
      :closable="false"
      show-icon
    />

    <!-- Web Target Section -->
    <el-card class="web-target-card" shadow="never">
      <template #header>
        <div class="card-header">
          <el-icon><Monitor /></el-icon>
          <span>浏览器接收地址</span>
        </div>
      </template>
      <el-input v-model="webTargetUrl" placeholder="输入其他设备的浏览器接收地址" clearable>
        <template #append>
          <el-button @click="connectWebTarget" type="primary">连接</el-button>
        </template>
      </el-input>
    </el-card>

    <!-- Actions Grid -->
    <div class="actions-grid">
      <el-card class="action-card" shadow="hover" @click="sendFiles">
        <div class="action-icon">📁</div>
        <div class="action-text">
          <div class="action-title">发送文件</div>
          <div class="action-desc">选择文件发送到设备</div>
        </div>
      </el-card>

      <el-card class="action-card" shadow="hover" @click="sendFolder">
        <div class="action-icon">📂</div>
        <div class="action-text">
          <div class="action-title">发送文件夹</div>
          <div class="action-desc">选择文件夹发送到设备</div>
        </div>
      </el-card>

      <el-card class="action-card" shadow="hover" @click="textDialogVisible = true">
        <div class="action-icon">📝</div>
        <div class="action-text">
          <div class="action-title">发送文本</div>
          <div class="action-desc">输入文本发送到设备</div>
        </div>
      </el-card>

      <el-card class="action-card" shadow="hover" @click="sendClipboard">
        <div class="action-icon">📋</div>
        <div class="action-text">
          <div class="action-title">发送剪贴板</div>
          <div class="action-desc">发送剪贴板内容到设备</div>
        </div>
      </el-card>
    </div>

    <!-- Drop Zone -->
    <el-card
      class="drop-zone"
      :class="{ 'drag-over': isDragging }"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      shadow="never"
    >
      <el-icon :size="48" color="#909399"><Upload /></el-icon>
      <p>拖拽文件到此处发送</p>
    </el-card>

    <!-- Text Dialog -->
    <el-dialog v-model="textDialogVisible" title="发送文本" width="500px">
      <el-input v-model="textInput" type="textarea" :rows="8" placeholder="输入要发送的文本..." />
      <template #footer>
        <el-button @click="textDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="sendText">发送</el-button>
      </template>
    </el-dialog>

    <!-- Progress -->
    <el-progress
      v-if="sending"
      :percentage="progressPercent"
      :status="progressPercent === 100 ? 'success' : undefined"
      class="send-progress"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ElMessage } from "element-plus";
import { Monitor, Upload } from "@element-plus/icons-vue";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const webTargetUrl = ref("");
const textDialogVisible = ref(false);
const textInput = ref("");
const isDragging = ref(false);
const sending = ref(false);
const progressPercent = ref(0);

const selectedDevice = computed(() => store.selectedDevice);

const currentTargetText = computed(() => {
  if (store.webTargetUrl) {
    return `当前目标: 浏览器 (${store.webTargetUrl})`;
  }
  if (selectedDevice.value) {
    return `当前目标: ${selectedDevice.value.name} (${selectedDevice.value.ip})`;
  }
  return "";
});

const checkTarget = () => {
  if (!selectedDevice.value && !store.webTargetUrl) {
    ElMessage.warning("请先选择设备或输入浏览器接收地址");
    return false;
  }

  // Check if device has required properties
  if (selectedDevice.value) {
    if (!selectedDevice.value.ip || !selectedDevice.value.transferPort) {
      ElMessage.error("设备信息不完整，请重新选择设备");
      store.setSelectedDevice(null);
      return false;
    }
  }

  return true;
};

const sendFiles = async () => {
  if (!checkTarget()) return;

  const filePaths = await window.api.selectFiles();
  if (!filePaths || filePaths.length === 0) return;

  sending.value = true;
  try {
    if (store.webTargetUrl) {
      for (const filePath of filePaths) {
        const result = await window.api.uploadFileToWeb({
          baseUrl: store.webTargetUrl,
          filePath,
        });
        if (!result.success) throw new Error(result.error);
      }
      ElMessage.success(`已发送 ${filePaths.length} 个文件`);
    } else if (selectedDevice.value) {
      console.log("Sending files to device:", {
        ip: selectedDevice.value.ip,
        port: selectedDevice.value.transferPort,
        fileCount: filePaths.length,
      });

      const result = await window.api.sendFiles({
        deviceIp: selectedDevice.value.ip,
        devicePort: selectedDevice.value.transferPort,
        filePaths,
      });

      if (result.success) {
        ElMessage.success(`已发送 ${filePaths.length} 个文件`);
      } else {
        throw new Error(result.error || "发送失败");
      }
    }
  } catch (e: any) {
    console.error("Send files error:", e);
    ElMessage.error("发送失败: " + (e.message || "未知错误"));
  } finally {
    sending.value = false;
    progressPercent.value = 0;
  }
};

const sendFolder = async () => {
  if (!checkTarget()) return;

  const folderPath = await window.api.selectFolder();
  if (!folderPath) return;

  sending.value = true;
  try {
    if (store.webTargetUrl) {
      const result = await window.api.uploadFolderToWeb({
        baseUrl: store.webTargetUrl,
        folderPath,
      });
      if (result.success) {
        ElMessage.success(`已发送文件夹 (${result.successCount} 个文件)`);
      } else {
        throw new Error(`部分文件发送失败`);
      }
    } else if (selectedDevice.value) {
      const result = await window.api.sendFolder({
        deviceIp: selectedDevice.value.ip,
        devicePort: selectedDevice.value.transferPort,
        folderPath,
      });
      if (result.success) {
        ElMessage.success("已发送文件夹");
      } else {
        throw new Error(result.error);
      }
    }
  } catch (e: any) {
    ElMessage.error("发送失败: " + e.message);
  } finally {
    sending.value = false;
    progressPercent.value = 0;
  }
};

const sendText = async () => {
  const text = textInput.value.trim();
  if (!text) {
    ElMessage.warning("请输入文本");
    return;
  }
  if (!checkTarget()) return;

  try {
    if (store.webTargetUrl) {
      const result = await window.api.uploadTextToWeb({
        baseUrl: store.webTargetUrl,
        text,
      });
      if (result.success) {
        ElMessage.success("已发送文本");
        textDialogVisible.value = false;
        textInput.value = "";
      } else {
        throw new Error(result.error);
      }
    } else if (selectedDevice.value) {
      const result = await window.api.sendText({
        deviceIp: selectedDevice.value.ip,
        devicePort: selectedDevice.value.transferPort,
        text,
      });
      if (result.success) {
        ElMessage.success("已发送文本");
        textDialogVisible.value = false;
        textInput.value = "";
      } else {
        throw new Error(result.error);
      }
    }
  } catch (e: any) {
    ElMessage.error("发送失败: " + e.message);
  }
};

const sendClipboard = async () => {
  if (!checkTarget()) return;

  sending.value = true;
  try {
    if (store.webTargetUrl) {
      const result = await window.api.sendClipboard({
        webMode: true,
        baseUrl: store.webTargetUrl,
      });
      if (result.success) {
        ElMessage.success("已发送剪贴板");
      } else {
        throw new Error(result.error);
      }
    } else if (selectedDevice.value) {
      const result = await window.api.sendClipboard({
        deviceIp: selectedDevice.value.ip,
        devicePort: selectedDevice.value.transferPort,
      });
      if (result.success) {
        ElMessage.success("已发送剪贴板");
      } else {
        throw new Error(result.error);
      }
    }
  } catch (e: any) {
    ElMessage.error("发送失败: " + e.message);
  } finally {
    sending.value = false;
  }
};

const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
};

const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  if (!checkTarget()) return;

  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length === 0) return;

  const filePaths = files.map((f: any) => f.path);
  sending.value = true;
  try {
    if (store.webTargetUrl) {
      for (const filePath of filePaths) {
        const result = await window.api.uploadFileToWeb({
          baseUrl: store.webTargetUrl,
          filePath,
        });
        if (!result.success) throw new Error(result.error);
      }
      ElMessage.success(`已发送 ${filePaths.length} 个文件`);
    } else if (selectedDevice.value) {
      const result = await window.api.sendFiles({
        deviceIp: selectedDevice.value.ip,
        devicePort: selectedDevice.value.transferPort,
        filePaths,
      });
      if (result.success) {
        ElMessage.success(`已发送 ${filePaths.length} 个文件`);
      } else {
        throw new Error(result.error);
      }
    }
  } catch (e: any) {
    ElMessage.error("发送失败: " + e.message);
  } finally {
    sending.value = false;
    progressPercent.value = 0;
  }
};

const connectWebTarget = () => {
  const url = webTargetUrl.value.trim();
  if (!url) {
    ElMessage.warning("请输入浏览器接收地址");
    return;
  }
  store.setWebTargetUrl(url);
  store.setSelectedDevice(null);
  ElMessage.success("已设置浏览器接收地址");
};

const clearTarget = () => {
  if (store.webTargetUrl) {
    store.setWebTargetUrl(null);
    webTargetUrl.value = "";
    ElMessage.info("已取消浏览器目标");
  } else if (selectedDevice.value) {
    store.setSelectedDevice(null);
    ElMessage.info(`已断开与 ${selectedDevice.value.name} 的连接`);
  }
};

// Listen for progress
window.api.onTransferProgress((info) => {
  progressPercent.value = info.percent;
});
</script>

<style scoped>
.send-panel {
  display: flex;
  flex-direction: column;
  gap: clamp(16px, 2vw, 20px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: clamp(13px, 1.3vw, 14px);
}

.web-target-card {
  border-radius: 8px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
  gap: clamp(10px, 1.2vw, 12px);
}

.action-card {
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 8px;
}

.action-card:hover {
  border-color: var(--el-border-color-hover);
}

.action-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: clamp(10px, 1.2vw, 12px);
  padding: clamp(14px, 1.6vw, 16px);
}

.action-icon {
  font-size: clamp(20px, 2.2vw, 24px);
  line-height: 1;
  width: clamp(36px, 4vw, 40px);
  height: clamp(36px, 4vw, 40px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  flex-shrink: 0;
}

.action-text {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: clamp(12px, 1.3vw, 13px);
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.action-desc {
  font-size: clamp(11px, 1.1vw, 12px);
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.drop-zone {
  border: 2px dashed var(--el-border-color);
  border-radius: 12px;
  padding: clamp(32px, 4vw, 40px) clamp(24px, 3vw, 32px);
  text-align: center;
  transition: all 0.15s;
  cursor: pointer;
}

.drop-zone:hover,
.drop-zone.drag-over {
  border-color: var(--el-color-primary);
  background: var(--el-fill-color);
}

.drop-zone p {
  margin: 12px 0 0 0;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  font-size: clamp(12px, 1.2vw, 13px);
}

.send-progress {
  margin-top: clamp(16px, 2vw, 20px);
}
</style>
