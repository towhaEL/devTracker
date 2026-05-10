const chokidar = require('chokidar')
const { exec }  = require('child_process')
const path      = require('path')
const db        = require('./db')
const sessionDetector = require('./sessionDetector')

/** @type {import('chokidar').FSWatcher | null} */
let watcher = null

// Debounce map: filePath → last event timestamp
const debounceMap = new Map()
const DEBOUNCE_MS = 10_000 // 10 seconds per file

// ─── IDE Detection ────────────────────────────────────────────────────────────

const IDE_PROCESSES = {
  'code.exe':    'VS Code',
  'code':        'VS Code',
  'idea64.exe':  'IntelliJ IDEA',
  'idea.exe':    'IntelliJ IDEA',
  'webstorm64.exe': 'WebStorm',
  'webstorm.exe':   'WebStorm',
  'pycharm64.exe':  'PyCharm',
  'pycharm.exe':    'PyCharm',
  'clion64.exe': 'CLion',
  'nvim':        'Neovim',
  'vim':         'Vim',
  'sublime_text.exe': 'Sublime Text',
  'atom.exe':    'Atom',
  'cursor.exe':  'Cursor',
}

let currentIde = 'Unknown'

function detectIde() {
  const cmd = process.platform === 'win32'
    ? 'tasklist /fo csv /nh'
    : 'ps -eo comm='

  exec(cmd, { timeout: 3000 }, (err, stdout) => {
    if (err) return
    const lower = stdout.toLowerCase()
    for (const [proc, ide] of Object.entries(IDE_PROCESSES)) {
      if (lower.includes(proc.toLowerCase())) {
        currentIde = ide
        return
      }
    }
    currentIde = 'Unknown'
  })
}

// Poll for IDE every 60 seconds
let ideInterval = null

// ─── Watcher ──────────────────────────────────────────────────────────────────

/**
 * Derive a project name from a file path and list of watched dirs.
 * Uses the name of the top-level watched dir that contains the file.
 */
function inferProject(filePath, watchedPaths) {
  for (const dir of watchedPaths) {
    if (filePath.startsWith(dir)) {
      return path.basename(dir)
    }
  }
  return path.basename(path.dirname(filePath))
}

/**
 * Start watching the given list of directories.
 * @param {string[]} dirs
 */
function startWatching(dirs) {
  if (watcher) {
    watcher.close()
    watcher = null
  }
  if (!dirs || dirs.length === 0) {
    console.log('[Watcher] No directories configured.')
    return
  }

  console.log('[Watcher] Watching:', dirs)

  watcher = chokidar.watch(dirs, {
    ignored: [
      /(^|[/\\])\../,           // dotfiles
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/__pycache__/**',
      '**/*.pyc',
      '**/.DS_Store',
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  })

  watcher.on('change', (filePath) => handleFileEvent(filePath, dirs))
  watcher.on('add',    (filePath) => handleFileEvent(filePath, dirs))
  watcher.on('error',  (error)    => console.error('[Watcher] Error:', error))

  // Start IDE detection
  detectIde()
  ideInterval = setInterval(detectIde, 60_000)
}

function handleFileEvent(filePath, watchedDirs) {
  const now = Date.now()
  const last = debounceMap.get(filePath) || 0

  if (now - last < DEBOUNCE_MS) return // debounced
  debounceMap.set(filePath, now)

  const project = inferProject(filePath, watchedDirs)
  const event = {
    timestamp: now,
    file: filePath,
    project,
    ide: currentIde,
  }

  // Persist event
  db.insertEvent(event)

  // Feed to session detector
  sessionDetector.processActivity(event)

  console.log(`[Watcher] Activity: ${project} — ${path.basename(filePath)} (${currentIde})`)
}

function stopWatching() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
  if (ideInterval) {
    clearInterval(ideInterval)
    ideInterval = null
  }
  debounceMap.clear()
  console.log('[Watcher] Stopped.')
}

function restartWatching() {
  const repos = db.getWatchedRepos()
  const dirs  = repos.map(r => r.path)
  startWatching(dirs)
}

module.exports = { startWatching, stopWatching, restartWatching, detectIde }
