import { showToast } from "./ui.js";
import { devices, syncingDevices } from "./state.js";
import { getPlatformEmoji, escapeHtml } from "./utils.js";

export function toggleSync(device) {
  const enabled = !syncingDevices.has(device.id);
  window.api.toggleClipboardSync({
    enabled,
    deviceId: device.id,
    deviceIp: device.ip,
    wsPort: device.clipboardPort,
  });
  if (enabled) {
    syncingDevices.add(device.id);
    showToast(`已启用与 ${device.name} 的剪贴板同步`, "success");
  } else {
    syncingDevices.delete(device.id);
    showToast(`已停止与 ${device.name} 的剪贴板同步`, "info");
  }
  renderClipboardDevices();
}

export function renderClipboardDevices() {
  const container = document.getElementById("clipboard-device-list");
  if (devices.length === 0) {
    container.innerHTML = '<div class="empty-state">未发现设备</div>';
    return;
  }
  container.innerHTML = devices
    .map(
      (d) => `
    <div class="clipboard-device-card">
      <div class="device-icon">${getPlatformEmoji(d.platform)}</div>
      <div class="device-info">
        <div class="device-name">${escapeHtml(d.name)}</div>
        <div class="device-ip">${escapeHtml(d.ip)}</div>
      </div>
      <button class="sync-btn ${syncingDevices.has(d.id) ? "active" : ""}" data-id="${d.id}">
        ${syncingDevices.has(d.id) ? "停止同步" : "开始同步"}
      </button>
    </div>
  `
    )
    .join("");

  container.querySelectorAll(".sync-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const device = devices.find((d) => d.id === btn.dataset.id);
      if (device) toggleSync(device);
    });
  });
}

export function listenClipboardEvents() {
  window.api.onClipboardSynced((info) => {
    showToast(`收到剪贴板 来自 ${info.from}`, "info");
    addClipboardLog(info);
  });

  window.api.onClipboardPeerStatus((status) => {
    if (status.connected) {
      syncingDevices.add(status.deviceId);
    } else {
      syncingDevices.delete(status.deviceId);
    }
    renderClipboardDevices();
  });
}

function addClipboardLog(info) {
  const container = document.getElementById("clipboard-log");
  const entry = document.createElement("div");
  entry.className = "clipboard-log-entry";
  entry.innerHTML = `
    <div class="log-time">${new Date().toLocaleTimeString()}</div>
    <div class="log-content">
      <strong>${escapeHtml(info.from)}</strong> 发送了
      ${info.type === "text" ? "文本" : info.type === "image" ? "图片" : "文件"}
    </div>
  `;
  container.insertBefore(entry, container.firstChild);
}
