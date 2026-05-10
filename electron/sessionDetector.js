const db  = require('./db')
const { BrowserWindow } = require('electron')

// Active sessions: Map<project, { id, startTime, eventCount, lastActivity }>
const activeSessions = new Map()

let gapMinutes = 15 // overridden from settings on init

function init() {
  const setting = db.getSetting('session_gap_minutes')
  if (setting) gapMinutes = parseInt(setting, 10)

  // Resume any open sessions from a previous run
  const open = db.getOpenSessions()
  for (const s of open) {
    const now = Date.now()
    const gapMs = gapMinutes * 60 * 1000
    if (now - s.start_time > gapMs * 2) {
      // Session is stale — close it
      db.updateSession(s.id, { end_time: s.start_time + gapMs, event_count: s.event_count })
    } else {
      activeSessions.set(s.project, {
        id: s.id,
        startTime: s.start_time,
        eventCount: s.event_count || 0,
        lastActivity: s.start_time,
      })
    }
  }
}

/**
 * Called on every file activity event.
 * Decides whether to continue an existing session or start a new one.
 */
function processActivity(event) {
  const { project, timestamp } = event
  const gapMs = gapMinutes * 60 * 1000

  const existing = activeSessions.get(project)

  if (existing) {
    const gap = timestamp - existing.lastActivity
    if (gap > gapMs) {
      // Gap exceeded → close old session, start fresh
      closeSession(project, existing.lastActivity + gapMs)
      openSession(project, timestamp)
    } else {
      // Continue session
      existing.lastActivity = timestamp
      existing.eventCount += 1
    }
  } else {
    // Brand new project activity
    openSession(project, timestamp)
  }

  broadcastSessions()
}

function openSession(project, startTime) {
  const result = db.insertSession({ project, start_time: startTime })
  activeSessions.set(project, {
    id: result.lastInsertRowid,
    startTime,
    eventCount: 1,
    lastActivity: startTime,
  })
  console.log(`[Session] Started: "${project}" at ${new Date(startTime).toLocaleTimeString()}`)
}

function closeSession(project, endTime) {
  const session = activeSessions.get(project)
  if (!session) return

  db.updateSession(session.id, {
    end_time: endTime,
    event_count: session.eventCount,
  })
  activeSessions.delete(project)
  console.log(`[Session] Closed: "${project}" (${session.eventCount} events)`)
}

/**
 * Close all sessions that have been idle beyond the gap threshold.
 * Called by a periodic check.
 */
function flushIdleSessions() {
  const now   = Date.now()
  const gapMs = gapMinutes * 60 * 1000

  for (const [project, session] of activeSessions.entries()) {
    if (now - session.lastActivity > gapMs) {
      closeSession(project, session.lastActivity + gapMs)
    }
  }

  if (activeSessions.size > 0) broadcastSessions()
}

/**
 * Returns active sessions as plain objects for IPC.
 */
function getActiveSessions() {
  const now = Date.now()
  return Array.from(activeSessions.entries()).map(([project, s]) => ({
    project,
    sessionId: s.id,
    startTime: s.startTime,
    elapsedMs: now - s.startTime,
    eventCount: s.eventCount,
    lastActivity: s.lastActivity,
  }))
}

/**
 * Update gap threshold from settings.
 */
function setGapMinutes(minutes) {
  gapMinutes = minutes
}

/**
 * Push session update to all renderer windows.
 */
function broadcastSessions() {
  const sessions = getActiveSessions()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('sessions-updated', sessions)
    }
  }
}

/**
 * Close all open sessions (called on app quit).
 */
function closeAllSessions() {
  const now = Date.now()
  for (const [project] of activeSessions.entries()) {
    closeSession(project, now)
  }
}

module.exports = {
  init,
  processActivity,
  openSession,
  closeSession,
  flushIdleSessions,
  getActiveSessions,
  setGapMinutes,
  closeAllSessions,
}
