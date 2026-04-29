import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (title: string, body: string) =>
    ipcRenderer.send('show-notification', { title, body }),
  showWindow: () => ipcRenderer.send('show-window'),
  updateTrayQuakes: (quakes: { magnitude: number; place: string; timestamp: string }[]) =>
    ipcRenderer.send('update-tray-quakes', quakes),
})
