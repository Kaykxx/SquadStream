// SquadStream Desktop: abre o site hospedado (atualiza sozinho a cada deploy)
// e captura o áudio do sistema automaticamente ao transmitir a tela.
const { app, BrowserWindow, desktopCapturer, session, shell, ipcMain } = require('electron')
const path = require('node:path')

const SITE = process.env.SQUAD_URL || 'https://squad-stream.vercel.app'
const ORIGIN = new URL(SITE).origin

if (!app.requestSingleInstanceLock()) app.quit()

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: '#0b0d12', autoHideMenuBar: true,
    // Barra de título na cor do app: só os botões (minimizar/fechar) ficam por cima.
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#0b0d12', symbolColor: '#e4e4e7', height: 32 }, icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  win.maximize()
  // F11 alterna tela cheia de verdade.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { e.preventDefault(); win.setFullScreen(!win.isFullScreen()) }
  })
  // Faixa de 32px no topo (arrastável) para a página não ficar embaixo dos botões da janela.
  win.webContents.on('did-finish-load', () => {
    win.webContents.insertCSS('body{box-sizing:border-box;padding-top:32px}#ss-drag{position:fixed;top:0;left:0;right:0;height:32px;z-index:2147483647;-webkit-app-region:drag;background:#0b0d12;display:flex;align-items:center;padding-left:12px;font:600 12px system-ui;color:#8b92a5}')
    win.webContents.executeJavaScript("if(!document.getElementById('ss-drag')){const d=document.createElement('div');d.id='ss-drag';d.textContent='SquadStream';document.body.appendChild(d)}")
  })
  win.loadURL(SITE)
  // Links externos abrem no navegador; o app só navega no próprio site.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== ORIGIN) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url) }
  })
  win.on('closed', () => { win = null })
}

/** Janelinha para escolher qual tela/janela transmitir. Resolve com a fonte ou null. */
function pickSource(parent, sources) {
  return new Promise((resolve) => {
    const picker = new BrowserWindow({
      parent, modal: true, width: 760, height: 520, resizable: false, minimizable: false,
      autoHideMenuBar: true, backgroundColor: '#12151c', title: 'Escolha o que transmitir',
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
    })
    let done = false
    const finish = (id) => {
      if (done) return
      done = true
      ipcMain.removeListener('picker:choose', onChoose)
      if (!picker.isDestroyed()) picker.close()
      resolve(sources.find((s) => s.id === id) || null)
    }
    const onChoose = (event, id) => { if (event.sender === picker.webContents) finish(id) }
    ipcMain.on('picker:choose', onChoose)
    picker.on('closed', () => finish(null))
    picker.loadFile(path.join(__dirname, 'picker.html'))
    picker.webContents.once('did-finish-load', () => {
      picker.webContents.send('picker:sources', sources.map((s) => ({
        id: s.id, name: s.name, thumb: s.thumbnail.toDataURL(), icon: s.appIcon ? s.appIcon.toDataURL() : null,
      })))
    })
  })
}

app.whenReady().then(() => {
  const ses = session.defaultSession

  // Só o nosso site pode usar câmera/mic/captura.
  const allowed = new Set(['media', 'display-capture', 'fullscreen', 'clipboard-sanitized-write'])
  ses.setPermissionRequestHandler((wc, permission, cb) => cb(allowed.has(permission) && new URL(wc.getURL()).origin === ORIGIN))
  ses.setPermissionCheckHandler((wc, permission, origin) => allowed.has(permission) && origin.startsWith(ORIGIN))

  // getDisplayMedia: escolhe a fonte na nossa janelinha e liga o áudio do sistema (loopback) sempre.
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 }, fetchWindowIcons: true })
      const chosen = await pickSource(win, sources)
      if (!chosen) { callback({}); return }
      callback({ video: chosen, audio: 'loopback' })
    } catch (e) {
      console.error('[desktop] captura falhou', e)
      callback({})
    }
  }, { useSystemPicker: false })

  createWindow()
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  app.on('activate', () => { if (!win) createWindow() })
})

app.on('window-all-closed', () => app.quit())
