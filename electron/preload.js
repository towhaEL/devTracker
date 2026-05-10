const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('devtracker', {
  // ── Today ─────────────────────────────────────────────────────────────────
  getTodaySummary:   ()       => ipcRenderer.invoke('get-today-summary'),
  generateReport:    (date)   => ipcRenderer.invoke('generate-report', date),
  saveReport:        (date, content) => ipcRenderer.invoke('save-report', date, content),
  copyToClipboard:   (text)   => ipcRenderer.invoke('copy-to-clipboard', text),

  // ── History ───────────────────────────────────────────────────────────────
  getReport:         (date)   => ipcRenderer.invoke('get-report', date),
  getReportDates:    ()       => ipcRenderer.invoke('get-report-dates'),

  // ── Sessions ──────────────────────────────────────────────────────────────
  getActiveSessions: ()       => ipcRenderer.invoke('get-active-sessions'),
  onSessionsUpdated: (cb)     => {
    const handler = (_event, sessions) => cb(sessions)
    ipcRenderer.on('sessions-updated', handler)
    return () => ipcRenderer.removeListener('sessions-updated', handler)
  },

  // ── Settings & Repos ──────────────────────────────────────────────────────
  getSettings:       ()          => ipcRenderer.invoke('get-settings'),
  saveSetting:       (key, val)  => ipcRenderer.invoke('save-setting', key, val),
  getWatchedRepos:   ()          => ipcRenderer.invoke('get-watched-repos'),
  addRepo:           (repoPath)  => ipcRenderer.invoke('add-repo', repoPath),
  removeRepo:        (id)        => ipcRenderer.invoke('remove-repo', id),
  selectDirectory:   ()          => ipcRenderer.invoke('select-directory'),

  // ── Git ───────────────────────────────────────────────────────────────────
  triggerGitCollect: ()          => ipcRenderer.invoke('trigger-git-collect'),

  // ── AutoLaunch ────────────────────────────────────────────────────────────
  getAutoLaunch:     ()          => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch:     (enabled)   => ipcRenderer.invoke('set-auto-launch', enabled),
})
