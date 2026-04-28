"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
let tray = null;
function setupTray(mainWindow2) {
  const iconPath = path.join(__dirname, "../../resources/tray-icon.png");
  let icon;
  try {
    icon = electron.nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = electron.nativeImage.createEmpty();
    }
  } catch {
    icon = electron.nativeImage.createEmpty();
  }
  tray = new electron.Tray(icon);
  tray.setToolTip("Seismic Network");
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Göster",
      click: () => {
        mainWindow2.show();
        mainWindow2.focus();
      }
    },
    { type: "separator" },
    {
      label: "Çıkış",
      click: () => {
        mainWindow2.removeAllListeners("close");
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow2.isVisible()) {
      mainWindow2.focus();
    } else {
      mainWindow2.show();
    }
  });
}
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.meruto187.seismic");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  setupTray(mainWindow);
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow?.show();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.ipcMain.on("show-notification", (_event, { title, body }) => {
  new electron.Notification({ title, body }).show();
});
electron.ipcMain.on("show-window", () => {
  mainWindow?.show();
  mainWindow?.focus();
});
