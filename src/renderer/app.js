// ============================================
// LanFlare — Renderer App Logic
// ============================================

let selectedDevice = null;
let devices = [];
let receiveHistory = [];
let syncingDevices = new Set();
let webTargetUrl = null; // manual web receiver target

// ---- Initialize ----
document.addEventListener("DOMContentLoaded", async () => {
  await initDeviceInfo();
  await initWebSettings();
  await initSettings();
  initTabs();
  initActions();
  initDropZone();
  initTextModal();
  initWindowControls();
  initWebTarget();
  listenEvents();
  refreshDevices();
});

// ---- Web Receiver Settings ----
async function initWebSettings() {
  const settings = await window.api.getWebSettings();

  const toggle = document.getElementById("web-enabled-toggle");
  const passwordInput = document.getElementById("web-password-input");
  const passwordRow = document.getElementById("web-password-row");
  const urlBar = document.getElementById("web-url-bar");
  const visBtn = document.getElementById("web-pw-visibility");

  toggle.checked = settings.webEnabled;
  passwordInput.value = settings.webPassword || "";
  _updateWebBarState(settings.webEnabled, urlBar);

  // Enable/disable toggle
  toggle.addEventListener("change", async () => {
    const enabled = toggle.checked;
    _updateWebBarState(enabled, urlBar);

    if (enabled && !passwordInput.value.trim()) {
      showToast("提示：未设置访问密码，任何人都可访问浏览器收发页面", "info");
    }

    await window.api.setWebSettings({
      webEnabled: enabled,
      webPassword: passwordInput.value,
    });
    showToast(enabled ? "浏览器收发已启用" : "浏览器收发已禁用", "info");
  });

  // Apply password button
  document.getElementById("web-password-apply").addEventListener("click", async () => {
    const pw = passwordInput.value.trim();
    await window.api.setWebSettings({
      webEnabled: toggle.checked,
      webPassword: pw,
    });
    showToast(pw ? "访问密码已设置" : "访问密码已清除", "success");
  });

  // Show/hide password visibility
  visBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    visBtn.style.color = isPassword ? "var(--accent-1)" : "";
  });

  // Also allow Enter key to apply password
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

function _updateWebBarState(enabled, urlBar) {
  if (enabled) {
    urlBar.classList.remove("disabled");
  } else {
    urlBar.classList.add("disabled");
  }
}

// ---- Settings ----
async function initSettings() {
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

  // Native window frame toggle
  const nativeFrameToggle = document.getElementById("native-frame-toggle");
  const useNativeFrame = await window.api.getWindowFrameSetting();
  nativeFrameToggle.checked = useNativeFrame;

  nativeFrameToggle.addEventListener("change", async () => {
    const enabled = nativeFrameToggle.checked;
    const result = await window.api.setWindowFrameSetting(enabled);
    if (result.success) {
      showToast(
        enabled ? "已启用原生窗口框架，请重启应用生效" : "已禁用原生窗口框架，请重启应用生效",
        "info"
      );
    } else {
      showToast("设置失败", "error");
      nativeFrameToggle.checked = !enabled;
    }
  });
}

// ---- Device Info ----
async function initDeviceInfo() {
  const info = await window.api.getDeviceInfo();
  document.getElementById("self-name").textContent = info.name;
  document.getElementById("self-ip").textContent = info.ip;
  if (info.webUrl) {
    document.getElementById("web-url").textContent = info.webUrl;
    document.getElementById("web-url").title = "其他设备可通过此地址在浏览器发送文件";
    document.getElementById("web-url-bar").addEventListener("click", () => {
      navigator.clipboard
        .writeText(info.webUrl)
        .then(() => {
          showToast("已复制链接", "success");
        })
        .catch(() => {
          // fallback
          const ta = document.createElement("textarea");
          ta.value = info.webUrl;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          showToast("已复制链接", "success");
        });
    });
  }
}

// ---- Web Target (manual URL) ----
function initWebTarget() {
  const input = document.getElementById("web-target-url-input");
  const connectBtn = document.getElementById("web-target-connect");
  const clearBtn = document.getElementById("web-target-clear");

  function setWebTarget(url) {
    webTargetUrl = url;
    selectedDevice = null;
    // Update UI
    document.getElementById("no-target").classList.add("hidden");
    document.getElementById("target-info").classList.add("hidden");
    const info = document.getElementById("web-target-info");
    info.classList.remove("hidden");
    document.getElementById("web-target-display").textContent = webTargetUrl;
    renderDevices();
    document.querySelector('[data-tab="send"]').click();
  }

  function clearWebTarget() {
    webTargetUrl = null;
    document.getElementById("web-target-info").classList.add("hidden");
    document.getElementById("target-info").classList.add("hidden");
    document.getElementById("no-target").classList.remove("hidden");
    input.value = "";
  }

  connectBtn.addEventListener("click", () => {
    let url = input.value.trim();
    if (!url) return showToast("请输入目标地址", "error");
    if (!/^https?:\/\//i.test(url)) url = "http://" + url;
    // Remove trailing slash
    url = url.replace(/\/$/, "");
    setWebTarget(url);
    showToast(`已连接到 ${url}`, "success");
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") connectBtn.click();
  });

  clearBtn.addEventListener("click", () => {
    clearWebTarget();
    showToast("已断开连接", "info");
  });

  document.getElementById("target-clear").addEventListener("click", () => {
    clearDevice();
    showToast("已清除选择", "info");
  });
}

// ---- Tabs ----
function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((tc) => tc.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

// ---- Device Discovery ----
function refreshDevices() {
  window.api.getDevices().then((d) => {
    devices = d;
    renderDevices();
  });
}

window.api.onDevicesChanged((newDevices) => {
  devices = newDevices;
  renderDevices();
  renderClipboardDevices();
});

function renderDevices() {
  const list = document.getElementById("device-list");
  const empty = document.getElementById("empty-devices");

  if (devices.length === 0) {
    empty.classList.remove("hidden");
    // Keep scan animation visible
    const cards = list.querySelectorAll(".device-card");
    cards.forEach((c) => c.remove());
    return;
  }

  empty.classList.add("hidden");

  // Remove old cards
  const oldCards = list.querySelectorAll(".device-card");
  oldCards.forEach((c) => c.remove());

  devices.forEach((device) => {
    const card = document.createElement("div");
    card.className = `device-card${selectedDevice && selectedDevice.id === device.id ? " selected" : ""}`;
    card.innerHTML = `
      <div class="device-avatar">${getPlatformEmoji(device.platform)}</div>
      <div class="device-info">
        <div class="device-name">${escapeHtml(device.name)}</div>
        <div class="device-ip">${device.ip}</div>
      </div>
      <button class="device-sync-btn${syncingDevices.has(device.id) ? " syncing" : ""}" title="剪贴板同步" data-device-id="${device.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
      </button>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".device-sync-btn")) return;
      selectDevice(device);
    });

    const syncBtn = card.querySelector(".device-sync-btn");
    syncBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSync(device);
    });

    list.appendChild(card);
  });
}

async function selectDevice(device) {
  // Send connection request
  showToast("正在请求连接...", "info");

  try {
    const result = await window.api.requestConnection(device.ip, device.id);
    if (result.approved) {
      selectedDevice = device;
      webTargetUrl = null;
      renderDevices();

      // Hide web target info if visible
      document.getElementById("web-target-info").classList.add("hidden");
      document.getElementById("no-target").classList.add("hidden");
      const info = document.getElementById("target-info");
      info.classList.remove("hidden");
      document.getElementById("target-avatar").textContent = getPlatformEmoji(device.platform);
      document.getElementById("target-name").textContent = device.name;
      document.getElementById("target-ip").textContent = `${device.ip}:${device.tcpPort}`;

      // Switch to send tab
      document.querySelector('[data-tab="send"]').click();
      showToast("连接已建立", "success");
    } else {
      showToast("连接请求被拒绝", "error");
    }
  } catch (err) {
    showToast(err.message || "连接请求失败", "error");
  }
}

function clearDevice() {
  selectedDevice = null;
  document.getElementById("target-info").classList.add("hidden");
  document.getElementById("no-target").classList.remove("hidden");
  renderDevices();
}

// ---- Send Actions ----
function initActions() {
  document.getElementById("action-files").addEventListener("click", sendFiles);
  document.getElementById("action-folder").addEventListener("click", sendFolderAction);
  document.getElementById("action-text").addEventListener("click", showTextModal);
  document.getElementById("action-clipboard").addEventListener("click", sendClipboardAction);
  document
    .getElementById("open-save-dir")
    .addEventListener("click", () => window.api.openSaveDir());
}

async function sendFiles() {
  if (!selectedDevice && !webTargetUrl)
    return showToast("请先选择目标设备或输入浏览器接收地址", "error");

  const files = await window.api.selectFiles();
  if (!files || files.length === 0) return;

  if (webTargetUrl) {
    showSendProgress(`上传 ${files.length} 个文件至浏览器接收端...`);
    let failed = 0;
    for (const fp of files) {
      const r = await window.api.uploadFileToWeb({
        baseUrl: webTargetUrl,
        filePath: fp,
      });
      if (!r.success) failed++;
    }
    hideSendProgress();
    if (failed === 0) showToast(`已上传 ${files.length} 个文件`, "success");
    else showToast(`${failed} 个文件上传失败`, "error");
    return;
  }

  showSendProgress(`发送 ${files.length} 个文件...`);
  const result = await window.api.sendFiles({
    deviceIp: selectedDevice.ip,
    devicePort: selectedDevice.tcpPort,
    filePaths: files,
  });
  hideSendProgress();
  if (result.success)
    showToast(`已发送 ${files.length} 个文件到 ${selectedDevice.name}`, "success");
  else showToast(`发送失败: ${result.error}`, "error");
}

async function sendFolderAction() {
  if (!selectedDevice && !webTargetUrl)
    return showToast("请先选择目标设备或输入浏览器接收地址", "error");
  const folder = await window.api.selectFolder();
  if (!folder) return;

  if (webTargetUrl) {
    showSendProgress("发送文件夹至浏览器...");
    const result = await window.api.uploadFolderToWeb({
      baseUrl: webTargetUrl,
      folderPath: folder,
    });
    hideSendProgress();
    if (result.success)
      showToast(`文件夹已发送至浏览器端 (${result.successCount} 个文件)`, "success");
    else if (result.successCount > 0)
      showToast(`部分完成: ${result.successCount} 成功, ${result.failedCount} 失败`, "info");
    else showToast(`发送失败: ${result.failedCount} 个文件失败`, "error");
    return;
  }

  showSendProgress("发送文件夹...");
  const result = await window.api.sendFolder({
    deviceIp: selectedDevice.ip,
    devicePort: selectedDevice.tcpPort,
    folderPath: folder,
  });
  hideSendProgress();
  if (result.success) showToast(`已发送文件夹到 ${selectedDevice.name}`, "success");
  else showToast(`发送失败: ${result.error}`, "error");
}

async function sendClipboardAction() {
  if (!selectedDevice && !webTargetUrl)
    return showToast("请先选择目标设备或输入浏览器接收地址", "error");

  if (webTargetUrl) {
    // Only text clipboard is supported for web receiver
    const result = await window.api.sendClipboard({
      webMode: true,
      baseUrl: webTargetUrl,
    });
    if (result.success) showToast("剪贴板文本已发送至浏览器接收端", "success");
    else showToast(`发送失败: ${result.error}`, "error");
    return;
  }

  showSendProgress("发送剪贴板内容...");
  const result = await window.api.sendClipboard({
    deviceIp: selectedDevice.ip,
    devicePort: selectedDevice.tcpPort,
  });
  hideSendProgress();
  if (result.success) showToast(`已发送剪贴板到 ${selectedDevice.name}`, "success");
  else showToast(`发送失败: ${result.error}`, "error");
}

// ---- Text Modal ----
function initTextModal() {
  document.getElementById("text-cancel").addEventListener("click", hideTextModal);
  document.getElementById("text-send").addEventListener("click", sendTextAction);
}

function showTextModal() {
  if (!selectedDevice && !webTargetUrl)
    return showToast("请先选择目标设备或输入浏览器接收地址", "error");
  document.getElementById("text-modal").classList.remove("hidden");
  document.getElementById("text-input").focus();
}

function hideTextModal() {
  document.getElementById("text-modal").classList.add("hidden");
  document.getElementById("text-input").value = "";
}

async function sendTextAction() {
  const text = document.getElementById("text-input").value.trim();
  if (!text) return showToast("请输入文本内容", "error");

  hideTextModal();

  if (webTargetUrl) {
    const result = await window.api.uploadTextToWeb({
      baseUrl: webTargetUrl,
      text,
    });
    if (result.success) showToast("文本已发送至浏览器接收端", "success");
    else showToast(`发送失败: ${result.error}`, "error");
    return;
  }

  showSendProgress("发送文本...");
  const result = await window.api.sendText({
    deviceIp: selectedDevice.ip,
    devicePort: selectedDevice.tcpPort,
    text,
  });
  hideSendProgress();
  if (result.success) showToast(`已发送文本到 ${selectedDevice.name}`, "success");
  else showToast(`发送失败: ${result.error}`, "error");
}

// ---- Drag & Drop ----
function initDropZone() {
  const zone = document.getElementById("drop-zone");

  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });

  document.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      zone.classList.remove("drag-over");
    }
  });

  document.addEventListener("drop", async (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");

    if (!selectedDevice && !webTargetUrl)
      return showToast("请先选择目标设备或输入浏览器接收地址", "error");

    const items = Array.from(e.dataTransfer.files);
    if (items.length === 0) return;

    // Separate files and folders by checking webkitRelativePath or type
    // In Electron, directories have empty type and size of 0 (or non-zero on some OS)
    // We rely on main process to properly distinguish via fs.statSync
    const allPaths = items.map((f) => f.path).filter(Boolean);
    if (allPaths.length === 0) return;

    if (webTargetUrl) {
      showSendProgress(`上传 ${allPaths.length} 个项目至浏览器接收端...`);
      let failed = 0;
      let sent = 0;
      for (const fp of allPaths) {
        // uploadFileToWeb now auto-detects folders
        const r = await window.api.uploadFileToWeb({
          baseUrl: webTargetUrl,
          filePath: fp,
        });
        if (r.success) sent += r.count || 1;
        else failed++;
      }
      hideSendProgress();
      if (failed === 0) showToast(`已上传 ${sent} 个文件`, "success");
      else showToast(`${failed} 个项目上传失败`, "error");
      return;
    }

    showSendProgress(`发送 ${allPaths.length} 个项目...`);
    const result = await window.api.sendFiles({
      deviceIp: selectedDevice.ip,
      devicePort: selectedDevice.tcpPort,
      filePaths: allPaths,
    });
    hideSendProgress();
    if (result.success) showToast(`已发送到 ${selectedDevice.name}`, "success");
    else showToast(`发送失败: ${result.error}`, "error");
  });
}

// ---- Progress ----
function showSendProgress(text) {
  const container = document.getElementById("send-progress-container");
  container.classList.remove("hidden");
  document.getElementById("send-progress-text").textContent = text;
  document.getElementById("send-progress-percent").textContent = "0%";
  document.getElementById("send-progress-fill").style.width = "0%";
}

function hideSendProgress() {
  setTimeout(() => {
    document.getElementById("send-progress-container").classList.add("hidden");
  }, 500);
}

// ---- Clipboard Sync ----
function toggleSync(device) {
  const isSyncing = syncingDevices.has(device.id);

  if (isSyncing) {
    syncingDevices.delete(device.id);
    window.api.toggleClipboardSync({
      enabled: false,
      deviceId: device.id,
      deviceIp: device.ip,
      wsPort: device.wsPort,
    });
    showToast(`已关闭与 ${device.name} 的剪贴板同步`, "info");
  } else {
    syncingDevices.add(device.id);
    window.api.toggleClipboardSync({
      enabled: true,
      deviceId: device.id,
      deviceIp: device.ip,
      wsPort: device.wsPort,
    });
    showToast(`已开启与 ${device.name} 的剪贴板同步`, "success");
  }

  renderDevices();
  renderClipboardDevices();
}

function renderClipboardDevices() {
  const container = document.getElementById("clipboard-devices");

  if (devices.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>左侧设备列表中发现的设备将显示在这里</p>
        <span class="hint">点击设备卡片上的同步按钮开启剪贴板同步</span>
      </div>`;
    return;
  }

  container.innerHTML = devices
    .map(
      (d) => `
    <div class="clipboard-device-card">
      <div class="device-avatar">${getPlatformEmoji(d.platform)}</div>
      <div class="device-info">
        <div class="device-name">${escapeHtml(d.name)}</div>
        <div class="device-ip">${d.ip}</div>
      </div>
      <label class="sync-toggle-wrap">
        <input type="checkbox" class="sync-toggle" data-device-id="${d.id}" ${syncingDevices.has(d.id) ? "checked" : ""}>
      </label>
    </div>
  `
    )
    .join("");

  container.querySelectorAll(".sync-toggle").forEach((toggle) => {
    toggle.addEventListener("change", () => {
      const deviceId = toggle.dataset.deviceId;
      const device = devices.find((d) => d.id === deviceId);
      if (device) toggleSync(device);
    });
  });
}

// ---- Listen for events from main ----
function listenEvents() {
  window.api.onTransferProgress((info) => {
    document.getElementById("send-progress-fill").style.width = info.percent + "%";
    document.getElementById("send-progress-percent").textContent = info.percent + "%";
  });

  window.api.onTransferComplete((info) => {
    receiveHistory.unshift(info);
    renderReceiveHistory();
  });

  window.api.onClipboardSynced((info) => {
    addClipboardLog(info);
  });

  window.api.onClipboardPeerStatus((info) => {
    if (!info.connected) {
      syncingDevices.delete(info.deviceId);
      renderDevices();
      renderClipboardDevices();
    }
  });

  window.api.onConnectionRequest((request) => {
    showConnectionRequestModal(request);
  });
}

function updateReceiveBadge() {
  const badge = document.getElementById("receive-badge");
  if (!badge) return;
  const count = receiveHistory.length;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function renderReceiveHistory() {
  const list = document.getElementById("receive-list");
  const empty = document.getElementById("empty-receives");

  // Always remove old rendered items first
  list.querySelectorAll(".receive-item").forEach((el) => el.remove());

  updateReceiveBadge();

  if (receiveHistory.length === 0) {
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");

  // Newest first (descending timestamp)
  const sorted = [...receiveHistory].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  sorted.forEach((item) => {
    const el = document.createElement("div");
    el.className = "receive-item";

    let icon, label, meta;
    if (item.type === "folder") {
      icon = `<div class="receive-item-icon type-file">📂</div>`;
      label = item.folderName || item.fileName || "文件夹";
      const fileCount = item.totalFiles || 0;
      const sizeStr = item.fileSize ? formatSize(item.fileSize) : "";
      meta = `文件夹 · ${fileCount} 个文件${sizeStr ? " · " + sizeStr : ""}`;
    } else if (item.type === "file" || item.type === "clipboard-image") {
      icon = `<div class="receive-item-icon type-file">📄</div>`;
      label = item.fileName || "Unknown file";
      meta = item.fileSize ? formatSize(item.fileSize) : "";
    } else if (item.type === "text" || item.type === "clipboard-text") {
      icon = `<div class="receive-item-icon type-text">📝</div>`;
      label =
        (item.content || "").substring(0, 60) + ((item.content || "").length > 60 ? "..." : "");
      meta = "文本";
    }

    const delBtn = `<button class="receive-delete-btn" title="删除"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l8 8M6 14L14 6"/></svg></button>`;

    el.innerHTML = `
      ${icon}
      <div class="receive-item-info">
        <div class="receive-item-name">${escapeHtml(label)}</div>
        <div class="receive-item-meta">来自 ${escapeHtml(item.from || "Unknown")} · ${meta}</div>
      </div>
      <div class="receive-item-time">${formatTime(item.timestamp)}</div>
      ${delBtn}
    `;

    // 点击打开
    el.addEventListener("click", (e) => {
      if (e.target.closest(".receive-delete-btn")) return;
      if (item.type === "folder" && (item.folderSavePath || item.savePath)) {
        window.api.openPath(item.folderSavePath || item.savePath);
      } else if ((item.type === "file" || item.type === "clipboard-image") && item.savePath) {
        window.api.openPath(item.savePath);
      }
    });

    // 删除按钮事件
    el.querySelector(".receive-delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const hasFile =
        (item.type === "file" || item.type === "clipboard-image" || item.type === "folder") &&
        item.savePath;

      function removeFromHistory() {
        const idx = receiveHistory.indexOf(item);
        if (idx !== -1) receiveHistory.splice(idx, 1);
        renderReceiveHistory();
      }

      if (hasFile) {
        const displayName =
          item.type === "folder" ? item.folderName || "此文件夹" : item.fileName || "此文件";
        showDeleteModal(displayName, async (action) => {
          if (action === "cancel") return;
          if (action === "file") {
            try {
              if (item.type === "folder" && item.folderSavePath) {
                // Delete folder recursively using API
                const r = await window.api.deleteFolder(item.folderSavePath);
                if (r && r.success) showToast("文件夹已删除", "success");
                else showToast("文件夹删除失败", "info");
              } else {
                const r = await window.api.deleteFile(item.savePath);
                if (r && r.success) showToast("文件已删除", "success");
                else showToast("文件删除失败（可能已不存在）", "info");
              }
            } catch {
              showToast("删除失败", "error");
            }
          } else {
            showToast("已移除记录", "info");
          }
          removeFromHistory();
        });
      } else {
        // 文本类直接移除
        removeFromHistory();
      }
    });

    list.appendChild(el);
  });
}

function addClipboardLog(info) {
  const list = document.getElementById("clipboard-log-list");

  const entry = document.createElement("div");
  entry.className = "log-entry";

  // Format preview based on content type
  let displayPreview = info.preview;
  let icon = "⬇";
  if (info.contentType === "image") {
    icon = "🖼️";
  } else if (info.contentType === "files") {
    icon = "📁";
  } else if (info.contentType === "folder") {
    icon = "📂";
    if (info.folderInfo) {
      const { name, fileCount, totalSize } = info.folderInfo;
      const sizeStr = formatSize(totalSize);
      displayPreview = `文件夹: ${name} (${fileCount} 个文件, ${sizeStr})`;
    }
  }

  entry.innerHTML = `
    <span class="log-entry-arrow">${icon}</span>
    <span class="log-entry-text">来自 <strong>${escapeHtml(info.from)}</strong>: ${escapeHtml(displayPreview)}</span>
    <span class="log-entry-time">${formatTime(Date.now())}</span>
  `;

  list.insertBefore(entry, list.firstChild);

  // Keep max 50 entries
  while (list.children.length > 50) {
    list.removeChild(list.lastChild);
  }

  // Show toast with appropriate message
  let toastMsg = "剪贴板已同步";
  if (info.contentType === "image") {
    toastMsg = "剪贴板图片已同步";
  } else if (info.contentType === "files") {
    toastMsg = "剪贴板文件路径已同步";
  } else if (info.contentType === "folder" && info.folderInfo) {
    toastMsg = `文件夹 "${info.folderInfo.name}" 已同步到剪贴板`;
  } else if (info.preview) {
    toastMsg = `剪贴板已同步: ${info.preview.substring(0, 40)}`;
  }
  showToast(toastMsg, "info");
}

// ---- Window Controls ----
async function initWindowControls() {
  // Check if using native frame and hide custom titlebar if so
  const useNativeFrame = await window.api.getWindowFrameSetting();
  const titlebar = document.getElementById("titlebar");
  if (useNativeFrame) {
    titlebar.style.display = "none";
  }

  document
    .getElementById("btn-minimize")
    .addEventListener("click", () => window.api.windowMinimize());
  document
    .getElementById("btn-maximize")
    .addEventListener("click", () => window.api.windowMaximize());
  document.getElementById("btn-close").addEventListener("click", () => window.api.windowClose());
}

// ---- Delete Confirm Modal ----
function showDeleteModal(fileName, callback) {
  const modal = document.getElementById("del-modal");
  const desc = document.getElementById("del-modal-desc");
  const btnCancel = document.getElementById("del-cancel");
  const btnRecord = document.getElementById("del-record-only");
  const btnFile = document.getElementById("del-file-and-record");

  desc.textContent = `「${fileName}」`;
  modal.classList.remove("hidden");

  function cleanup() {
    modal.classList.add("hidden");
    btnCancel.onclick = null;
    btnRecord.onclick = null;
    btnFile.onclick = null;
    document.getElementById("del-modal-overlay").onclick = null;
  }

  document.getElementById("del-modal-overlay").onclick = () => {
    cleanup();
    callback("cancel");
  };
  btnCancel.onclick = () => {
    cleanup();
    callback("cancel");
  };
  btnRecord.onclick = () => {
    cleanup();
    callback("record");
  };
  btnFile.onclick = () => {
    cleanup();
    callback("file");
  };
}

// ---- Toast ----
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ---- Helpers ----
function getPlatformEmoji(platform) {
  if (!platform) return "💻";
  if (platform === "win32") return "🖥️";
  if (platform === "darwin") return "🍎";
  if (platform === "linux") return "🐧";
  return "💻";
}

function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// ---- Connection Request Modal ----
let currentConnectionRequest = null;

function showConnectionRequestModal(request) {
  currentConnectionRequest = request;
  const modal = document.getElementById("connection-request-modal");
  const desc = document.getElementById("connection-request-desc");

  desc.textContent = `"${request.fromDeviceName}" (${request.fromIp}) 请求连接到您的设备`;

  modal.classList.remove("hidden");

  // Auto-hide after 30 seconds
  setTimeout(() => {
    if (modal.classList.contains("hidden") === false) {
      rejectConnectionRequest();
    }
  }, 30000);
}

function approveConnectionRequest() {
  if (!currentConnectionRequest) return;

  window.api.approveConnection(currentConnectionRequest.requestId);
  document.getElementById("connection-request-modal").classList.add("hidden");
  showToast("已同意连接", "success");
  currentConnectionRequest = null;
}

function rejectConnectionRequest() {
  if (!currentConnectionRequest) return;

  window.api.rejectConnection(currentConnectionRequest.requestId);
  document.getElementById("connection-request-modal").classList.add("hidden");
  showToast("已拒绝连接", "info");
  currentConnectionRequest = null;
}

// Add event listeners for connection request buttons
document.getElementById("connection-approve")?.addEventListener("click", approveConnectionRequest);
document.getElementById("connection-reject")?.addEventListener("click", rejectConnectionRequest);
