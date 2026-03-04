export function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => (toast.className = "toast"), 3000);
}

export function showSendProgress(text) {
  const prog = document.getElementById("send-progress");
  prog.textContent = text;
  prog.style.display = "block";
}

export function hideSendProgress() {
  const prog = document.getElementById("send-progress");
  prog.style.display = "none";
}

export function showDeleteModal(fileName, callback) {
  const modal = document.getElementById("delete-modal");
  const fileNameEl = document.getElementById("delete-file-name");
  const confirmBtn = document.getElementById("delete-confirm");
  const cancelBtn = document.getElementById("delete-cancel");

  fileNameEl.textContent = fileName;
  modal.style.display = "flex";

  const handleConfirm = () => {
    callback();
    modal.style.display = "none";
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
  };

  const handleCancel = () => {
    modal.style.display = "none";
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
  };

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", handleCancel);
}

export function showRestartConfirmModal(title, message) {
  const modal = document.getElementById("restart-modal");
  const titleEl = document.getElementById("restart-title");
  const messageEl = document.getElementById("restart-message");
  const confirmBtn = document.getElementById("restart-confirm");
  const cancelBtn = document.getElementById("restart-cancel");

  titleEl.textContent = title;
  messageEl.textContent = message;
  modal.style.display = "flex";

  const handleConfirm = async () => {
    await window.api.restartApp();
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
  };

  const handleCancel = () => {
    modal.style.display = "none";
    confirmBtn.removeEventListener("click", handleConfirm);
    cancelBtn.removeEventListener("click", handleCancel);
  };

  confirmBtn.addEventListener("click", handleConfirm);
  cancelBtn.addEventListener("click", handleCancel);
}

let currentConnectionRequest = null;

export function showConnectionRequestModal(request) {
  currentConnectionRequest = request;
  const modal = document.getElementById("connection-request-modal");
  const deviceNameEl = document.getElementById("connection-device-name");
  deviceNameEl.textContent = request.fromName;
  modal.style.display = "flex";
}

export async function approveConnectionRequest() {
  if (!currentConnectionRequest) return;
  await window.api.approveConnection(currentConnectionRequest.requestId);
  document.getElementById("connection-request-modal").style.display = "none";
  currentConnectionRequest = null;
}

export async function rejectConnectionRequest() {
  if (!currentConnectionRequest) return;
  await window.api.rejectConnection(currentConnectionRequest.requestId);
  document.getElementById("connection-request-modal").style.display = "none";
  currentConnectionRequest = null;
}

export function initWindowControls() {
  document.getElementById("window-minimize")?.addEventListener("click", () => {
    window.api.windowMinimize();
  });
  document.getElementById("window-maximize")?.addEventListener("click", () => {
    window.api.windowMaximize();
  });
  document.getElementById("window-close")?.addEventListener("click", () => {
    window.api.windowClose();
  });
}
