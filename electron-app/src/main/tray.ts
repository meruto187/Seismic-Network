import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
let _mainWindow: BrowserWindow | null = null

export interface QuakeSummary {
  magnitude: number
  place: string
  timestamp: string
}

function buildMenu(quakes: QuakeSummary[]): Electron.Menu {
  const quakeItems: Electron.MenuItemConstructorOptions[] = quakes.length === 0
    ? [{ label: 'Deprem verisi bekleniyor...', enabled: false }]
    : quakes.map(q => ({
        label: `M${q.magnitude.toFixed(1)}  ${q.place.slice(0, 36)}`,
        enabled: false,
      }))

  return Menu.buildFromTemplate([
    { label: 'Göster', click: () => { _mainWindow?.show(); _mainWindow?.focus() } },
    { type: 'separator' },
    { label: 'Son Depremler', enabled: false },
    ...quakeItems,
    { type: 'separator' },
    { label: 'Çıkış', click: () => { _mainWindow?.removeAllListeners('close'); app.quit() } },
  ])
}

export function updateTrayQuakes(quakes: QuakeSummary[]): void {
  if (!tray) return
  const latest = quakes[0]
  const tooltip = latest
    ? `Sismik Ağ — Son: M${latest.magnitude.toFixed(1)} ${latest.place.slice(0, 30)}`
    : 'Merkezi Sismik Ağ'
  tray.setToolTip(tooltip)
  tray.setContextMenu(buildMenu(quakes))
}

export function setupTray(mainWindow: BrowserWindow): void {
  _mainWindow = mainWindow
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
  tray.setToolTip('Merkezi Sismik Ağ')
  tray.setContextMenu(buildMenu([]))

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow.show()
    }
  })
}
