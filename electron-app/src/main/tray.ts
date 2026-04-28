import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function setupTray(mainWindow: BrowserWindow): void {
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty()
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Seismic Network')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Göster',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        mainWindow.removeAllListeners('close')
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow.show()
    }
  })
}
