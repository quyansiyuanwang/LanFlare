<template>
  <el-config-provider :locale="zhCn">
    <div id="app" :class="{ 'dark': theme === 'dark' }">
      <!-- Custom Titlebar -->
      <div class="titlebar">
        <div class="titlebar-drag">
          <div class="titlebar-logo">
            <span>LanFlare</span>
          </div>
        </div>
        <div class="titlebar-buttons">
          <el-button link @click="minimize" class="titlebar-btn">
            <el-icon><Minus /></el-icon>
          </el-button>
          <el-button link @click="maximize" class="titlebar-btn">
            <el-icon><FullScreen /></el-icon>
          </el-button>
          <el-button link @click="close" class="titlebar-btn btn-close">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>

      <div class="app-container">
        <!-- Sidebar -->
        <Sidebar />

        <!-- Main Panel -->
        <main class="main-panel">
          <!-- Tabs -->
          <el-tabs v-model="activeTab" @tab-change="handleTabChange" class="main-tabs">
            <el-tab-pane label="发送" name="/send">
              <template #label>
                <span class="tab-label">
                  <el-icon><Upload /></el-icon>
                  发送
                </span>
              </template>
              <router-view v-if="activeTab === '/send'" />
            </el-tab-pane>
            <el-tab-pane label="接收记录" name="/receive">
              <template #label>
                <span class="tab-label">
                  <el-icon><Download /></el-icon>
                  接收记录
                  <el-badge v-if="receiveCount > 0" :value="receiveCount" class="tab-badge" />
                </span>
              </template>
              <router-view v-if="activeTab === '/receive'" />
            </el-tab-pane>
            <el-tab-pane label="剪贴板同步" name="/clipboard">
              <template #label>
                <span class="tab-label">
                  <el-icon><DocumentCopy /></el-icon>
                  剪贴板同步
                </span>
              </template>
              <router-view v-if="activeTab === '/clipboard'" />
            </el-tab-pane>
            <el-tab-pane label="设置" name="/settings">
              <template #label>
                <span class="tab-label">
                  <el-icon><Setting /></el-icon>
                  设置
                </span>
              </template>
              <router-view v-if="activeTab === '/settings'" />
            </el-tab-pane>
          </el-tabs>
        </main>
      </div>

      <!-- Modals -->
      <ConnectionRequestModal ref="connectionModal" />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElConfigProvider, ElMessage } from "element-plus";
import zhCn from "element-plus/dist/locale/zh-cn.mjs";
import { Minus, FullScreen, Close, Upload, Download, DocumentCopy, Setting } from "@element-plus/icons-vue";
import { useAppStore } from "./stores/app";
import Sidebar from "./components/Sidebar.vue";
import ConnectionRequestModal from "./components/ConnectionRequestModal.vue";

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const theme = ref<"dark" | "light">("dark");
const activeTab = ref("/send");
const connectionModal = ref();

const receiveCount = computed(() => store.receiveHistory.length);

const minimize = () => window.api.windowMinimize();
const maximize = () => window.api.windowMaximize();
const close = () => window.api.windowClose();

const handleTabChange = (tabName: string) => {
  router.push(tabName);
};

onMounted(async () => {
  // Set initial tab from route
  activeTab.value = route.path;

  // Load theme
  theme.value = await window.api.getThemeSetting();
  if (theme.value === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }

  // Load device info
  const info = await window.api.getDeviceInfo();
  store.setDeviceInfo(info);

  // Listen for device changes
  window.api.onDevicesChanged((devices) => {
    store.setDevices(devices);
  });

  // Listen for transfer events
  window.api.onTransferComplete((info) => {
    store.addReceiveHistory({ ...info, timestamp: Date.now() });
    ElMessage.success(`收到文件来自 ${info.from}`);
  });

  window.api.onTransferProgress((info) => {
    // Progress handled in SendPanel
  });

  // Listen for connection requests
  window.api.onConnectionRequest((request) => {
    connectionModal.value?.show(request);
  });

  window.api.onConnectionAutoAccepted((request) => {
    ElMessage.info(`已自动接受来自 ${request.fromName} 的连接`);
  });

  // Initial device fetch
  const devices = await window.api.getDevices();
  store.setDevices(devices);
});

// Watch route changes
router.afterEach((to) => {
  activeTab.value = to.path;
});
</script>

<style>
.tab-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab-badge {
  margin-left: 4px;
}

.main-tabs {
  height: 100%;
  padding-left: clamp(12px, 1.5vw, 16px);
  padding-right: clamp(12px, 1.5vw, 16px);
  flex: 1;
  min-width: 0;
}

.main-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.main-tabs :deep(.el-tabs__content) {
  padding: clamp(20px, 3vw, 32px);
  height: calc(100% - 55px);
  overflow-y: auto;
}

.main-tabs :deep(.el-tabs__item) {
  height: var(--tab-height);
  line-height: var(--tab-height);
  font-size: clamp(12px, 1.2vw, 13px);
  padding: 0 clamp(16px, 2vw, 24px);
}

.titlebar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: var(--titlebar-height);
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.titlebar-drag {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 16px;
  min-width: 0;
}

.titlebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: clamp(12px, 1.2vw, 13px);
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.titlebar-buttons {
  display: flex;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
}

.titlebar-btn {
  width: 46px;
  height: var(--titlebar-height);
  border-radius: 0;
  margin: 0;
}

.titlebar-btn:hover {
  background: var(--el-fill-color-light);
}

.btn-close:hover {
  background: #ff3366;
  color: white;
}

.app-container {
  display: flex;
  height: calc(100vh - var(--titlebar-height));
  overflow: hidden;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}
</style>
