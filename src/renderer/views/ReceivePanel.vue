<template>
  <div class="receive-panel">
    <div class="panel-header">
      <h2>接收记录</h2>
      <el-button @click="openSaveDir" :icon="FolderOpened">打开下载目录</el-button>
    </div>

    <el-empty v-if="receiveHistory.length === 0" description="暂无接收记录" :image-size="120" />

    <el-scrollbar v-else height="calc(100vh - 200px)">
      <el-card
        v-for="(item, index) in receiveHistory"
        :key="index"
        class="receive-item"
        shadow="hover"
      >
        <div class="item-content">
          <div class="item-icon">{{ getTypeIcon(item.type) }}</div>
          <div class="item-info">
            <div class="item-name">{{ item.fileName || item.folderName || "文本" }}</div>
            <div class="item-meta">
              <el-tag size="small" type="info">{{ item.from }}</el-tag>
              <span>{{ formatTime(item.timestamp) }}</span>
              <span v-if="item.size">{{ formatSize(item.size) }}</span>
              <span v-if="item.totalFiles">{{ item.totalFiles }} 个文件</span>
            </div>
          </div>
          <div class="item-actions">
            <el-button v-if="item.savePath" size="small" @click="openPath(item.savePath)">
              打开
            </el-button>
            <el-button
              v-if="item.savePath"
              size="small"
              type="danger"
              @click="deleteItem(item, index)"
            >
              删除
            </el-button>
          </div>
        </div>
      </el-card>
    </el-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { FolderOpened } from "@element-plus/icons-vue";
import { useAppStore } from "../stores/app";

const store = useAppStore();
const receiveHistory = computed(() => store.receiveHistory);

const getTypeIcon = (type: string) => {
  if (type === "file") return "📄";
  if (type === "folder") return "📁";
  if (type === "text" || type === "clipboard-text") return "📝";
  if (type === "clipboard-image") return "🖼️";
  return "📦";
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

const openSaveDir = () => {
  window.api.openSaveDir();
};

const openPath = (path: string) => {
  window.api.openPath(path);
};

const deleteItem = async (item: any, index: number) => {
  try {
    const action = await ElMessageBox.confirm(
      `如何处理 ${item.fileName || item.folderName || "此项"}？`,
      "删除选项",
      {
        distinguishCancelAndClose: true,
        confirmButtonText: "删除文件和记录",
        cancelButtonText: "仅删除记录",
        type: "warning",
      }
    );

    // User clicked "删除文件和记录"
    if (item.savePath) {
      const isFolder = item.type === "folder";
      const result = isFolder
        ? await window.api.deleteFolder(item.savePath)
        : await window.api.deleteFile(item.savePath);

      if (result.success) {
        store.receiveHistory.splice(index, 1);
        ElMessage.success("文件和记录已删除");
      } else {
        ElMessage.error(`删除文件失败: ${result.error || "未知错误"}`);
      }
    } else {
      // No file path, just delete record
      store.receiveHistory.splice(index, 1);
      ElMessage.success("记录已删除");
    }
  } catch (action) {
    if (action === "cancel") {
      // User clicked "仅删除记录"
      store.receiveHistory.splice(index, 1);
      ElMessage.success("记录已删除");
    }
    // If action === "close", user clicked X or pressed ESC, do nothing
  }
};
</script>

<style scoped>
.receive-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.receive-item {
  margin-bottom: 10px;
  border-radius: 8px;
  transition: all 0.15s;
}

.receive-item :deep(.el-card__body) {
  padding: 14px;
}

.item-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-icon {
  font-size: 24px;
  line-height: 1;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-wrap: wrap;
}

.item-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
