import { showToast, showConnectionRequestModal } from "./ui.js";
import { devices, setDevices, selectedDevice, setSelectedDevice, syncingDevices } from "./state.js";
import { getPlatformEmoji, escapeHtml } from "./utils.js";

export function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });
}

export function refreshDevices() {
  window.api.getDevices().then((list) => {
    setDevices(list);
    renderDevices();
  });
}

export function renderDevices() {
  const container = document.getElementById("device-list");
  if (devices.length === 0) {
    container.innerHTML = '<div class="empty-state">未发现设备</div>';
    return;
  }
  container.innerHTML = devices
    .map(
      (d) => `
    <div class="device-card ${selectedDevice?.id === d.id ? "selected" : ""}" data-id="${d.id}">
      <div class="device-icon">${getPlatformEmoji(d.platform)}</div>
      <div class="device-info">
        <div class="device-name">${escapeHtml(d.name)}</div>
        <div class="device-ip">${escapeHtml(d.ip)}</div>
      </div>
    </div>
  `
    )
    .join("");

  container.querySelectorAll(".device-card").forEach((card) => {
    card.addEventListener("click", () => {
      const device = devices.find((d) => d.id === card.dataset.id);
      if (device) selectDevice(device);
    });
  });
}

export async function selectDevice(device) {
  const result = await window.api.requestConnection(device.ip, device.id);
  if (result.approved) {
    setSelectedDevice(device);
    renderDevices();
    renderClipboardDevices();
    showToast(`已连接到 ${device.name}`, "success");
  } else {
    showToast(result.error || "连接被拒绝", "error");
  }
}

export function clearDevice() {
  setSelectedDevice(null);
  renderDevices();
}

export async function initDeviceInfo() {
  const info = await window.api.getDeviceInfo();
  document.getElementById("self-name").textContent = info.name;
  document.getElementById("self-ip").textContent = info.ip;
  if (info.webUrl) {
    document.getElementById("web-url").textContent = info.webUrl;
    document.getElementById("web-url").title = "其他设备可通过此地址在浏览器发送文件";
    document.getElementById("web-url-bar").addEventListener("click", () => {
      navigator.clipboard.writeText(info.webUrl);
      showToast("已复制到剪贴板", "success");
    });
  }
}

export function initWebTarget() {
  const input = document.getElementById("web-target-input");
  const applyBtn = document.getElementById("web-target-apply");
  const clearBtn = document.getElementById("web-target-clear");

  applyBtn.addEventListener("click", () => {
    const url = input.value.trim();
    if (!url) {
      showToast("请输入浏览器接收地址", "error");
      return;
    }
    import("./state.js").then((state) => {
      state.setWebTargetUrl(url);
      showToast("已设置浏览器接收地址", "success");
      clearDevice();
    });
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    import("./state.js").then((state) => {
      state.setWebTargetUrl(null);
      showToast("已清除浏览器接收地址", "info");
    });
  });
}

export function listenDeviceEvents() {
  window.api.onDevicesChanged((list) => {
    setDevices(list);
    renderDevices();
  });

  window.api.onConnectionRequest((request) => {
    showConnectionRequestModal(request);
  });

  window.api.onConnectionAutoAccepted((request) => {
    showToast(`已自动接受来自 ${request.fromName} 的连接`, "info");
  });
}
