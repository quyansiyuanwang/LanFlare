<template>
  <div class="settings-panel">
    <el-card class="settings-card" shadow="never">
      <template #header>
        <div class="card-header">
          <el-icon><Setting /></el-icon>
          <span>基本设置</span>
        </div>
      </template>

      <el-form label-width="140px" label-position="left">
        <el-form-item label="下载目录">
          <div class="dir-setting">
            <span class="dir-path">{{ saveDir }}</span>
            <el-button size="small" @click="changeSaveDir">更改</el-button>
          </div>
        </el-form-item>

        <el-form-item label="主题">
          <el-select v-model="theme" @change="changeTheme" style="width: 200px">
            <el-option label="深色" value="dark" />
            <el-option label="浅色" value="light" />
          </el-select>
        </el-form-item>

        <el-form-item label="使用原生窗口框架">
          <el-switch v-model="useNativeFrame" @change="changeNativeFrame" />
          <span class="form-desc">需要重启应用</span>
        </el-form-item>

        <el-form-item label="自动接受连接请求">
          <el-switch v-model="autoAccept" @change="changeAutoAccept" />
          <span class="form-desc">自动同意其他设备的连接请求</span>
        </el-form-item>

        <el-form-item label="最小化到托盘">
          <el-switch v-model="minimizeToTray" @change="changeMinimizeToTray" />
          <span class="form-desc">关闭窗口时最小化到系统托盘</span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="settings-card" shadow="never">
      <template #header>
        <div class="card-header">
          <el-icon><Monitor /></el-icon>
          <span>浏览器收发设置</span>
        </div>
      </template>

      <el-form label-width="140px" label-position="left">
        <el-form-item label="启用浏览器收发">
          <el-switch v-model="webEnabled" @change="changeWebSettings" />
          <span class="form-desc">允许通过浏览器发送文件</span>
        </el-form-item>

        <el-form-item label="访问密码">
          <div class="password-setting">
            <el-input
              v-model="webPassword"
              type="password"
              placeholder="留空表示无密码"
              show-password
              style="width: 300px"
            />
            <el-button type="primary" @click="changeWebSettings">应用</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Setting, Monitor } from "@element-plus/icons-vue";

const saveDir = ref("");
const theme = ref<"dark" | "light">("dark");
const useNativeFrame = ref(false);
const autoAccept = ref(false);
const minimizeToTray = ref(false);
const webEnabled = ref(false);
const webPassword = ref("");
const previousWebPassword = ref(""); // Track previous password

onMounted(async () => {
  saveDir.value = await window.api.getSaveDir();
  theme.value = await window.api.getThemeSetting();
  useNativeFrame.value = await window.api.getWindowFrameSetting();
  autoAccept.value = await window.api.getAutoAcceptSetting();
  minimizeToTray.value = await window.api.getMinimizeToTraySetting();

  const webSettings = await window.api.getWebSettings();
  webEnabled.value = webSettings.webEnabled;
  webPassword.value = webSettings.webPassword || "";
  previousWebPassword.value = webSettings.webPassword || "";
});

const changeSaveDir = async () => {
  const newDir = await window.api.selectSaveDir();
  if (newDir) {
    const result = await window.api.setSaveDir(newDir);
    if (result.success) {
      saveDir.value = newDir;
      ElMessage.success("下载目录已更新");
    } else {
      ElMessage.error("更新失败");
    }
  }
};

const changeTheme = async () => {
  const result = await window.api.setThemeSetting(theme.value);
  if (result.success) {
    if (theme.value === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
    ElMessage.success(theme.value === "light" ? "已切换到浅色模式" : "已切换到深色模式");
  } else {
    ElMessage.error("设置失败");
  }
};

const changeNativeFrame = async () => {
  const result = await window.api.setWindowFrameSetting(useNativeFrame.value);
  if (result.success) {
    try {
      await ElMessageBox.confirm("需要重启应用才能生效，是否立即重启？", "重启应用", {
        confirmButtonText: "立即重启",
        cancelButtonText: "稍后",
        type: "info",
      });
      await window.api.restartApp();
    } catch {
      // User cancelled
    }
  } else {
    ElMessage.error("设置失败");
    useNativeFrame.value = !useNativeFrame.value;
  }
};

const changeAutoAccept = async () => {
  const result = await window.api.setAutoAcceptSetting(autoAccept.value);
  if (result.success) {
    ElMessage.success(autoAccept.value ? "已启用自动接受连接" : "已禁用自动接受连接");
  } else {
    ElMessage.error("设置失败");
    autoAccept.value = !autoAccept.value;
  }
};

const changeMinimizeToTray = async () => {
  const result = await window.api.setMinimizeToTraySetting(minimizeToTray.value);
  if (result.success) {
    ElMessage.success(minimizeToTray.value ? "已启用最小化到托盘" : "已禁用最小化到托盘");
  } else {
    ElMessage.error("设置失败");
    minimizeToTray.value = !minimizeToTray.value;
  }
};

const changeWebSettings = async () => {
  const result = await window.api.setWebSettings({
    webEnabled: webEnabled.value,
    webPassword: webPassword.value,
  });
  if (result.success) {
    // Determine what changed
    const passwordChanged = webPassword.value !== previousWebPassword.value;

    if (passwordChanged) {
      if (webPassword.value) {
        ElMessage.success("访问密码已设置");
      } else {
        ElMessage.success("访问密码已清除");
      }
      previousWebPassword.value = webPassword.value;
    } else {
      ElMessage.success(webEnabled.value ? "浏览器收发已启用" : "浏览器收发已禁用");
    }
  } else {
    ElMessage.error("设置失败");
  }
};
</script>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.settings-card {
  border-radius: 8px;
}

.settings-card :deep(.el-form-item) {
  margin-bottom: 20px;
}

.settings-card :deep(.el-form-item__label) {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.dir-setting,
.password-setting {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.dir-path {
  flex: 1;
  font-size: 12px;
  color: var(--el-text-color-regular);
  font-family: var(--font-mono, monospace);
  padding: 8px 12px;
  background: var(--el-fill-color);
  border-radius: 6px;
  border: 1px solid var(--el-border-color);
}

.form-desc {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
</style>
