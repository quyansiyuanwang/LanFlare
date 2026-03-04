import { showToast, showDeleteModal } from "./ui.js";
import { receiveHistory, addReceiveHistory } from "./state.js";
import { formatSize, formatTime, escapeHtml } from "./utils.js";

export function updateReceiveBadge() {
  const badge = document.getElementById("receive-badge");
  const count = receiveHistory.length;
  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : count;
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }
}

export function renderReceiveHistory() {
  const container = document.getElementById("receive-history");
  if (receiveHistory.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无接收记录</div>';
    return;
  }
  container.innerHTML = receiveHistory
    .slice()
    .reverse()
    .map(
      (item, idx) => `
    <div class="receive-item">
      <div class="receive-icon">${getTypeIcon(item.type)}</div>
      <div class="receive-info">
        <div class="receive-name">${escapeHtml(item.fileName || item.folderName || "文本")}</div>
        <div class="receive-meta">
          来自 ${escapeHtml(item.from)} · ${formatTime(item.timestamp)}
          ${item.size ? " · " + formatSize(item.size) : ""}
          ${item.totalFiles ? ` · ${item.totalFiles} 个文件` : ""}
        </div>
      </div>
      <div class="receive-actions">
        ${
          item.savePath
            ? `<button class="action-btn" data-action="open" data-idx="${receiveHistory.length - 1 - idx}">打开</button>`
            : ""
        }
        ${
          item.savePath
            ? `<button class="action-btn delete" data-action="delete" data-idx="${receiveHistory.length - 1 - idx}">删除</button>`
            : ""
        }
      </div>
    </div>
  `
    )
    .join("");

  container.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      const item = receiveHistory[idx];
      if (btn.dataset.action === "open") {
        window.api.openPath(item.savePath);
      } else if (btn.dataset.action === "delete") {
        showDeleteModal(item.fileName || item.folderName, async () => {
          const isFolder = item.type === "folder";
          const result = isFolder
            ? await window.api.deleteFolder(item.savePath)
            : await window.api.deleteFile(item.savePath);
          if (result.success) {
            receiveHistory.splice(idx, 1);
            renderReceiveHistory();
            updateReceiveBadge();
            showToast("已删除", "success");
          } else {
            showToast("删除失败", "error");
          }
        });
      }
    });
  });
}

function getTypeIcon(type) {
  if (type === "file") return "📄";
  if (type === "folder") return "📁";
  if (type === "text" || type === "clipboard-text") return "📝";
  if (type === "clipboard-image") return "🖼️";
  return "📦";
}

export function listenTransferEvents() {
  window.api.onTransferStart((info) => {
    showToast(`接收中: ${info.fileName || "文件"}`, "info");
  });

  window.api.onTransferComplete((info) => {
    addReceiveHistory({
      ...info,
      timestamp: Date.now(),
    });
    renderReceiveHistory();
    updateReceiveBadge();
  });
}
