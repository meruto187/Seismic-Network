"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  showNotification: (title, body) => electron.ipcRenderer.send("show-notification", { title, body }),
  showWindow: () => electron.ipcRenderer.send("show-window")
});
