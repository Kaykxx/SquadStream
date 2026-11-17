const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('picker', {
  onSources: (fn) => ipcRenderer.on('picker:sources', (_e, s) => fn(s)),
  choose: (id) => ipcRenderer.send('picker:choose', id),
})
