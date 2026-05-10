/**
 * db.js — SQLite via sql.js (pure WASM, no native compilation required)
 * The DB is loaded from disk on init, and flushed to disk on every write.
 */
const initSqlJs = require('sql.js')
const path      = require('path')
const fs        = require('fs')

const { app } = require('electron')

const DB_DIR  = path.join(app.getPath('userData'), 'devtracker')
const DB_PATH = path.join(DB_DIR, 'devtracker.db')

/** @type {import('sql.js').Database} */
let db = null

// ─── Init ──────────────────────────────────────────────────────────────────────

async function initDb() {
  const SQL = await initSqlJs()

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`PRAGMA foreign_keys = ON;`)

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      file      TEXT NOT NULL,
      project   TEXT NOT NULL,
      ide       TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project     TEXT NOT NULL,
      start_time  INTEGER NOT NULL,
      end_time    INTEGER,
      event_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS commits (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      repo          TEXT NOT NULL,
      hash          TEXT UNIQUE NOT NULL,
      message       TEXT,
      author        TEXT,
      timestamp     INTEGER,
      files_changed INTEGER DEFAULT 0,
      session_id    INTEGER
    );
    CREATE TABLE IF NOT EXISTS reports (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date         TEXT NOT NULL UNIQUE,
      content      TEXT,
      generated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS watched_repos (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      path   TEXT UNIQUE NOT NULL,
      name   TEXT,
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  // Default settings
  const defaults = {
    session_gap_minutes: '15',
    gemini_api_key: '',
    ai_summaries_enabled: 'false',
    theme: 'dark',
  }
  for (const [key, value] of Object.entries(defaults)) {
    db.run(`INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)`, [key, value])
  }

  persist()
  console.log('[DB] Initialized at', DB_PATH)
}

/** Write DB to disk */
function persist() {
  if (!db) return
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

/** Execute a query and return all rows as objects */
function all(sql, params = []) {
  if (!db) return []
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

/** Execute and return first row */
function get(sql, params = []) {
  const rows = all(sql, params)
  return rows[0] || null
}

/** Execute a mutation and return last insert rowid */
function run(sql, params = []) {
  if (!db) return { lastInsertRowid: null, changes: 0 }
  db.run(sql, params)
  persist()
  return {
    lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0][0],
    changes: db.getRowsModified(),
  }
}

// ─── Day bounds helper ─────────────────────────────────────────────────────────

function dayBounds(dateStr) {
  const start = new Date(dateStr + 'T00:00:00').getTime()
  const end   = start + 86400000
  return { start, end }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function insertEvent({ timestamp, file, project, ide }) {
  return run(`INSERT INTO events (timestamp,file,project,ide) VALUES (?,?,?,?)`,
    [timestamp, file, project, ide || null])
}

function getEventsForDate(dateStr) {
  const { start, end } = dayBounds(dateStr)
  return all(`SELECT * FROM events WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC`, [start, end])
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

function insertSession({ project, start_time }) {
  return run(`INSERT INTO sessions (project,start_time,event_count) VALUES (?,?,0)`, [project, start_time])
}

function updateSession(id, { end_time, event_count }) {
  return run(`UPDATE sessions SET end_time=?,event_count=? WHERE id=?`, [end_time, event_count, id])
}

function getSessionsForDate(dateStr) {
  const { start, end } = dayBounds(dateStr)
  return all(`SELECT * FROM sessions WHERE start_time>=? AND start_time<? ORDER BY start_time ASC`, [start, end])
}

function getOpenSessions() {
  return all(`SELECT * FROM sessions WHERE end_time IS NULL`)
}

function closeAllOpenSessions(endTime) {
  return run(`UPDATE sessions SET end_time=? WHERE end_time IS NULL`, [endTime])
}

// ─── Commits ──────────────────────────────────────────────────────────────────

function insertCommit({ repo, hash, message, author, timestamp, files_changed, session_id }) {
  return run(`
    INSERT OR IGNORE INTO commits (repo,hash,message,author,timestamp,files_changed,session_id)
    VALUES (?,?,?,?,?,?,?)`,
    [repo, hash, message, author, timestamp, files_changed || 0, session_id || null])
}

function getCommitsForDate(dateStr) {
  const { start, end } = dayBounds(dateStr)
  return all(`SELECT * FROM commits WHERE timestamp>=? AND timestamp<? ORDER BY timestamp ASC`, [start, end])
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function getReport(dateStr) {
  return get(`SELECT * FROM reports WHERE date=?`, [dateStr])
}

function saveReport(dateStr, content) {
  return run(`
    INSERT INTO reports (date,content,generated_at) VALUES (?,?,?)
    ON CONFLICT(date) DO UPDATE SET content=excluded.content, generated_at=excluded.generated_at`,
    [dateStr, content, Date.now()])
}

function getReportDates() {
  return all(`SELECT date FROM reports ORDER BY date DESC`).map(r => r.date)
}

// ─── Watched Repos ────────────────────────────────────────────────────────────

function getWatchedRepos() {
  return all(`SELECT * FROM watched_repos WHERE active=1 ORDER BY id ASC`)
}

function addWatchedRepo(repoPath, name) {
  const repoName = name || path.basename(repoPath)
  return run(`INSERT OR IGNORE INTO watched_repos (path,name) VALUES (?,?)`, [repoPath, repoName])
}

function removeWatchedRepo(id) {
  return run(`UPDATE watched_repos SET active=0 WHERE id=?`, [id])
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function getSetting(key) {
  const row = get(`SELECT value FROM settings WHERE key=?`, [key])
  return row ? row.value : null
}

function saveSetting(key, value) {
  return run(`INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, String(value)])
}

function getAllSettings() {
  const rows = all(`SELECT key,value FROM settings`)
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

module.exports = {
  initDb, persist,
  insertEvent, getEventsForDate,
  insertSession, updateSession, getSessionsForDate, getOpenSessions, closeAllOpenSessions,
  insertCommit, getCommitsForDate,
  getReport, saveReport, getReportDates,
  getWatchedRepos, addWatchedRepo, removeWatchedRepo,
  getSetting, saveSetting, getAllSettings,
  dayBounds,
}
