const { app, BrowserWindow, Tray, Menu, ipcMain, clipboard, dialog, nativeImage } = require('electron')
const path = require('path')

// Disable sandbox for preload script compatibility with contextIsolation
app.commandLine.appendSwitch('no-sandbox')

const db               = require('./db')
const watcher          = require('./watcher')
const sessionDetector  = require('./sessionDetector')
const gitCollector     = require('./gitCollector')
const summaryGenerator = require('./summaryGenerator')
const autoLaunch       = require('./autoLaunch')

const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null
let tray       = null
let idleTimer  = null

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  db.initDb()
  sessionDetector.init()

  createWindow()
  createTray()

  // Start background services
  const repos = db.getWatchedRepos()
  watcher.startWatching(repos.map(r => r.path))
  gitCollector.scheduleCollection()

  // Flush idle sessions every 5 minutes
  idleTimer = setInterval(() => {
    sessionDetector.flushIdleSessions()
    updateTrayTooltip()
  }, 5 * 60 * 1000)

  registerIpcHandlers()
})

app.on('window-all-closed', () => {
  // Keep running in tray on Windows/Linux; quit on macOS only if explicitly asked
  if (process.platform === 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  else mainWindow?.show()
})

app.on('before-quit', () => {
  sessionDetector.closeAllSessions()
  gitCollector.stopCollection()
  watcher.stopWatching()
  if (idleTimer) clearInterval(idleTimer)
})

// ─── BrowserWindow ────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, '..', 'assets', 'tray-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // Close to tray instead of quitting
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

// ─── System Tray ─────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png')
  let icon
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) throw new Error('empty')
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('DevTracker — Idle')
  tray.setContextMenu(buildTrayMenu())

  tray.on('double-click', () => {
    mainWindow ? mainWindow.show() : createWindow()
  })
}

function buildTrayMenu() {
  const sessions = sessionDetector.getActiveSessions()
  const activeLabel = sessions.length > 0
    ? `Active: ${sessions.map(s => s.project).join(', ')}`
    : 'Idle — no active session'

  return Menu.buildFromTemplate([
    { label: 'DevTracker', enabled: false },
    { type: 'separator' },
    { label: activeLabel, enabled: false },
    { type: 'separator' },
    { label: 'Open Dashboard', click: () => { mainWindow ? mainWindow.show() : createWindow() } },
    { label: 'Generate Report', click: async () => {
        const d = new Date()
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        await summaryGenerator.generateForDate(today)
        mainWindow?.webContents.send('report-generated', today)
      }
    },
    { type: 'separator' },
    { label: 'Quit DevTracker', click: () => { app.isQuitting = true; app.quit() } },
  ])
}

function updateTrayTooltip() {
  const sessions = sessionDetector.getActiveSessions()
  const label = sessions.length > 0
    ? `Active: ${sessions.map(s => s.project).join(', ')}`
    : 'DevTracker — Idle'
  tray?.setToolTip(label)
  tray?.setContextMenu(buildTrayMenu())
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  // ── Today ─────────────────────────────────────────────────────────────────
  ipcMain.handle('get-today-summary', async () => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const report = db.getReport(today)
    return report ? report.content : null
  })

  ipcMain.handle('generate-report', async (_e, date) => {
    let dStr = date
    if (!dStr) {
      const d = new Date()
      dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    return await summaryGenerator.generateForDate(dStr)
  })

  ipcMain.handle('save-report', async (_e, date, content) => {
    db.saveReport(date, content)
    return true
  })

  ipcMain.handle('copy-to-clipboard', async (_e, text) => {
    clipboard.writeText(text)
    return true
  })

  // ── History ───────────────────────────────────────────────────────────────
  ipcMain.handle('get-report', async (_e, date) => {
    return db.getReport(date)
  })

  ipcMain.handle('get-report-dates', async () => {
    return db.getReportDates()
  })

  // ── Sessions ──────────────────────────────────────────────────────────────
  ipcMain.handle('get-active-sessions', async () => {
    return sessionDetector.getActiveSessions()
  })

  // ── Settings & Repos ──────────────────────────────────────────────────────
  ipcMain.handle('get-settings', async () => {
    return {
      ...db.getAllSettings(),
      autoLaunch: autoLaunch.isEnabled(),
    }
  })

  ipcMain.handle('save-setting', async (_e, key, value) => {
    db.saveSetting(key, value)
    if (key === 'session_gap_minutes') {
      sessionDetector.setGapMinutes(parseInt(value, 10))
    }
    return true
  })

  ipcMain.handle('get-watched-repos', async () => {
    return db.getWatchedRepos()
  })

  ipcMain.handle('add-repo', async (_e, repoPath) => {
    db.addWatchedRepo(repoPath)
    watcher.restartWatching()
    return db.getWatchedRepos()
  })

  ipcMain.handle('remove-repo', async (_e, id) => {
    db.removeWatchedRepo(id)
    watcher.restartWatching()
    return db.getWatchedRepos()
  })

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Directory to Watch',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── Git ───────────────────────────────────────────────────────────────────
  ipcMain.handle('trigger-git-collect', async () => {
    await gitCollector.collectAll()
    return true
  })

  // ── AutoLaunch ────────────────────────────────────────────────────────────
  ipcMain.handle('get-auto-launch', () => autoLaunch.isEnabled())
  ipcMain.handle('set-auto-launch', (_e, enabled) => {
    enabled ? autoLaunch.enable() : autoLaunch.disable()
    return autoLaunch.isEnabled()
  })
}
