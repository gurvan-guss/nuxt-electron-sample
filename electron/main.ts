import { release } from 'os'
import path from 'path'
import { BrowserWindow, app, shell, protocol } from 'electron'

// Remove electron security warnings only in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/securit
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1'))
  app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32')
  app.setAppUserModelId(app.getName())
// https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null

const preload = path.join(__dirname, 'preload.js')
const distPath = path.join(__dirname, '../.output/public')

async function createWindow() {
  // Fix issue sometimes file path is duplicated
  // https://github.com/nuxt/framework/discussions/4569#discussioncomment-4341497
  protocol.interceptFileProtocol("file", (request, callback) => {
    const hasDuplicate = (str: string) => /.output\/public(.).*\1/.test(str)
    const parsedUrl = path.parse(request.url)

    if (hasDuplicate(parsedUrl.dir)) {
      // File path under .output/public
      const filePath = parsedUrl.dir
        .split(distPath)
        .filter(i => i && i !== 'file://')
        .join('')
      callback({ path: path.join(distPath, filePath, parsedUrl.base) })
    } else {
      callback({ url: request.url })
    }
  })

  win = new BrowserWindow({
    webPreferences: {
      preload,
      // Warning: Enabling nodeIntegration and disabling contextIsolation is not secure in production
      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (app.isPackaged) {
    win.loadFile(path.join(distPath, 'index.html'))
  }
  else {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!)
    win.webContents.openDevTools()
  }

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:'))
      shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin')
    app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized())
      win.restore()

    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length)
    allWindows[0].focus()
  else
    createWindow()
})

app.whenReady().then(() => {
  createWindow()
})
