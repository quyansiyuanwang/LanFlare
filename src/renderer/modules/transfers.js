import { showToast, showSendProgress, hideSendProgress } from "./ui.js";
import { selectedDevice, webTargetUrl } from "./state.js";

export function initActions() {
  document.getElementById("send-files-btn").addEventListener("click", sendFiles);
  document.getElementById("send-folder-btn").addEventListener("click", sendFolderAction);
  document.getElementById("send-clipboard-btn").addEventListener("click", sendClipboardAction);
}

export async function sendFiles() {
  if (!selectedDevice && !webTargetUrl) {
    showToast("请先选择设备或输入浏览器接收地址", "error");
    return;
  }
  const filePaths = await window.api.selectFiles();
  if (!filePaths || filePaths.length === 0) return;

  showSendProgress("发送中...");
  try {
    if (webTargetUrl) {
      for (const filePath of filePaths) {
        const result = await window.api.uploadFileToWeb({ baseUrl: webTargetUrl, filePath });
        if (!result.success) throw new Error(result.error);
      }
      showToast(`已发送 ${filePaths.length} 个文件`, "success");
    } else {
      const result = await window.api.sendFiles({
        deviceIp: selectedDevice.ip,
        devicePort: selectedDevice.transferPort,
        filePaths,
      });
      if (result.success) {
        showToast(`已发送 ${filePaths.length} 个文件`, "success");
      } else {
        throw new Error(result.error);
      }
    }
  } catch (e) {
    showToast("发送失败: " + e.message, "error");
  } finally {
    hideSendProgress();
  }
}

export async function sendFolderAction() {
  if (!selectedDevice && !webTargetUrl) {
    showToast("请先选择设备或输入浏览器接收地址", "error");
    return;
  }
  const folderPath = await window.api.selectFolder();
  if (!folderPath) return;

  showSendProgress("发送中...");
  try {
    if (webTargetUrl) {
      const result = await window.api.uploadFolderToWeb({ baseUrl: webTargetUrl, folderPath });
      if (result.success) {
        showToast(`已发送文件夹 (${result.successCount} 个文件)`, "success");
      } else {
        throw new Error(`部分文件发送失败 (${result.failedCount}/${result.totalCount})`);
      }
    } else {
      const result = await window.api.sendFolder({
        deviceIp: selectedDevice.ip,
        devicePort: selectedDevice.transferPort,
        folderPath,
      });
      if (result.success) {
        showToast("已发送文件夹", "success");
      } else {
        throw new Error(result.error);
      }
    }
  } catch (e) {
    showToast("发送失败: " + e.message, "error");
  } finally {
    hideSendProgress();
  }
}

export async function sendClipboardAction() {
  if (!selectedDevice && !webTargetUrl) {
    showToast("请先选择设备或输入浏览器接收地址", "error");
    return;
  }

  showSendProgress("发送中...");
  try {
    if (webTargetUrl) {
      const result = await window.api.sendClipboard({ webMode: true, baseUrl: webTargetUrl });
      if (result.success) {
        showToast("已发送剪贴板", "success");
      } else {
        throw new Error(result.error);
      }
    } else {
      const result = await window.api.sendClipboard({
        deviceIp: selectedDevice.ip,
        devicePort: selectedDevice.transferPort,
      });
      if (result.success) {
        showToast("已发送剪贴板", "success");
      } else {
        throw new Error(result.error);
      }
    }
  } catch (e) {
    showToast("发送失败: " + e.message, "error");
  } finally {
    hideSendProgress();
  }
}

export function initTextModal() {
  document.getElementById("send-text-btn").addEventListener("click", showTextModal);
  document.getElementById("text-modal-close").addEventListener("click", hideTextModal);
  document.getElementById("text-modal-send").addEventListener("click", sendTextAction);
}

function showTextModal() {
  document.getElementById("text-modal").style.display = "flex";
  document.getElementById("text-input").value = "";
  document.getElementById("text-input").focus();
}

function hideTextModal() {
  document.getElementById("text-modal").style.display = "none";
}

async function sendTextAction() {
  const text = document.getElementById("text-input").value.trim();
  if (!text) {
    showToast("请输入文本", "error");
    return;
  }
  if (!selectedDevice && !webTargetUrl) {
    showToast("请先选择设备或输入浏览器接收地址", "error");
    return;
  }

  try {
    if (webTargetUrl) {
      const result = await window.api.uploadTextToWeb({ baseUrl: webTargetUrl, text });
      if (result.success) {
        showToast("已发送文本", "success");
        hideTextModal();
      } else {
        throw new Error(result.error);
      }
    } else {
      const result = await window.api.sendText({
        deviceIp: selectedDevice.ip,
        devicePort: selectedDevice.transferPort,
        text,
      });
      if (result.success) {
        showToast("已发送文本", "success");
        hideTextModal();
      } else {
        throw new Error(result.error);
      }
    }
  } catch (e) {
    showToast("发送失败: " + e.message, "error");
  }
}

export function initDropZone() {
  const dropZone = document.getElementById("drop-zone");
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (!selectedDevice && !webTargetUrl) {
      showToast("请先选择设备或输入浏览器接收地址", "error");
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const filePaths = files.map((f) => f.path);
    showSendProgress("发送中...");
    try {
      if (webTargetUrl) {
        for (const filePath of filePaths) {
          const result = await window.api.uploadFileToWeb({ baseUrl: webTargetUrl, filePath });
          if (!result.success) throw new Error(result.error);
        }
        showToast(`已发送 ${filePaths.length} 个文件`, "success");
      } else {
        const result = await window.api.sendFiles({
          deviceIp: selectedDevice.ip,
          devicePort: selectedDevice.transferPort,
          filePaths,
        });
        if (result.success) {
          showToast(`已发送 ${filePaths.length} 个文件`, "success");
        } else {
          throw new Error(result.error);
        }
      }
    } catch (e) {
      showToast("发送失败: " + e.message, "error");
    } finally {
      hideSendProgress();
    }
  });
}
