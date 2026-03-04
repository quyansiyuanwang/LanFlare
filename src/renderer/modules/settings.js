import { showToast, showRestartConfirmModal } from "./ui.js";

export async function initWebSettings() {
  const settings = await window.api.getWebSettings();
  const toggle = document.getElementById("web-enabled-toggle");
  const passwordInput = document.getElementById("web-password-input");
  const urlBar = document.getElementById("web-url-bar");
  const visBtn = document.getElementById("web-pw-visibility");

  toggle.checked = settings.webEnabled;
  passwordInput.value = settings.webPassword || "";
  updateWebBarState(settings.webEnabled, urlBar);

  toggle.addEventListener("change", async () => {
    const enabled = toggle.checked;
    updateWebBarState(enabled, urlBar);
    if (enabled && !passwordInput.value.trim()) {
      showToast("提示：未设置访问密码，任何人都可访问浏览器收发页面", "info");
    }
    await window.api.setWebSettings({
      webEnabled: enabled,
      webPassword: passwordInput.value,
    });
    showToast(enabled ? "浏览器收发已启用" : "浏览器收发已禁用", "info");
  });

  document.getElementById("web-password-apply").addEventListener("click", async () => {
    const pw = passwordInput.value.trim();
    await window.api.setWebSettings({
      webEnabled: toggle.checked,
      webPassword: pw,
    });
    showToast(pw ? "访问密码已设置" : "访问密码已清除", "success");
  });

  visBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    visBtn.style.color = isPassword ? "var(--accent-1)" : "";
  });

  passwordInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const pw = passwordInput.value.trim();
      await window.api.setWebSettings({
        webEnabled: toggle.checked,
        webPassword: pw,
      });
      showToast(pw ? "访问密码已设置" : "访问密码已清除", "success");
    }
  });
}

function updateWebBarState(enabled, urlBar) {
  if (enabled) {
    urlBar.classList.remove("disabled");
  } else {
    urlBar.classList.add("disabled");
  }
}

export async function initSettings() {
  const saveDir = await window.api.getSaveDir();
  document.getElementById("save-dir-display").textContent = saveDir;

  document.getElementById("change-save-dir").addEventListener("click", async () => {
    const newDir = await window.api.selectSaveDir();
    if (newDir) {
      const result = await window.api.setSaveDir(newDir);
      if (result.success) {
        document.getElementById("save-dir-display").textContent = newDir;
        showToast("下载目录已更新", "success");
      } else {
        showToast("更新失败", "error");
      }
    }
  });

  const themeSelect = document.getElementById("theme-select");
  const currentTheme = await window.api.getThemeSetting();
  themeSelect.value = currentTheme;

  if (currentTheme === "light") {
    document.body.classList.add("light-theme");
  }

  themeSelect.addEventListener("change", async () => {
    const theme = themeSelect.value;
    const result = await window.api.setThemeSetting(theme);
    if (result.success) {
      if (theme === "light") {
        document.body.classList.add("light-theme");
      } else {
        document.body.classList.remove("light-theme");
      }
      showToast(theme === "light" ? "已切换到浅色模式" : "已切换到深色模式", "success");
    } else {
      showToast("设置失败", "error");
      themeSelect.value = currentTheme;
    }
  });

  const nativeFrameToggle = document.getElementById("native-frame-toggle");
  const useNativeFrame = await window.api.getWindowFrameSetting();
  nativeFrameToggle.checked = useNativeFrame;

  nativeFrameToggle.addEventListener("change", async () => {
    const enabled = nativeFrameToggle.checked;
    const result = await window.api.setWindowFrameSetting(enabled);
    if (result.success) {
      showRestartConfirmModal(
        enabled ? "已启用原生窗口框架" : "已禁用原生窗口框架",
        "需要重启应用才能生效，是否立即重启？"
      );
    } else {
      showToast("设置失败", "error");
      nativeFrameToggle.checked = !enabled;
    }
  });

  const autoAcceptToggle = document.getElementById("auto-accept-toggle");
  const autoAcceptEnabled = await window.api.getAutoAcceptSetting();
  autoAcceptToggle.checked = autoAcceptEnabled;

  autoAcceptToggle.addEventListener("change", async () => {
    const enabled = autoAcceptToggle.checked;
    const result = await window.api.setAutoAcceptSetting(enabled);
    if (result.success) {
      showToast(enabled ? "已启用自动接受连接" : "已禁用自动接受连接", "success");
    } else {
      showToast("设置失败", "error");
      autoAcceptToggle.checked = !enabled;
    }
  });

  const minimizeToTrayToggle = document.getElementById("minimize-to-tray-toggle");
  const minimizeToTrayEnabled = await window.api.getMinimizeToTraySetting();
  minimizeToTrayToggle.checked = minimizeToTrayEnabled;

  minimizeToTrayToggle.addEventListener("change", async () => {
    const enabled = minimizeToTrayToggle.checked;
    const result = await window.api.setMinimizeToTraySetting(enabled);
    if (result.success) {
      showToast(enabled ? "已启用最小化到托盘" : "已禁用最小化到托盘", "success");
    } else {
      showToast("设置失败", "error");
      minimizeToTrayToggle.checked = !enabled;
    }
  });
}
