import { initWebSettings, initSettings } from "./modules/settings.js";
import { initDeviceInfo, initTabs, refreshDevices, initWebTarget, listenDeviceEvents } from "./modules/devices.js";
import { initActions, initTextModal, initDropZone } from "./modules/transfers.js";
import { renderClipboardDevices, listenClipboardEvents } from "./modules/clipboard.js";
import { renderReceiveHistory, listenTransferEvents } from "./modules/receive.js";
import { initWindowControls, approveConnectionRequest, rejectConnectionRequest } from "./ui.js";

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

function listenEvents() {
  listenDeviceEvents();
  listenClipboardEvents();
  listenTransferEvents();
}

// Expose to global for modal buttons
window.approveConnectionRequest = approveConnectionRequest;
window.rejectConnectionRequest = rejectConnectionRequest;
