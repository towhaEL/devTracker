const simpleGit = require('simple-git')
const db = require('./db')
const path = require('path')

let collectInterval = null
const INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

async function collectFromRepo(repoPath) {
  const git = simpleGit(repoPath)
  const isRepo = await git.checkIsRepo()
  if (!isRepo) return

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let log
  try {
    log = await git.log({ '--since': today.toISOString() })
  } catch (err) {
    console.error(`[Git] Failed for ${repoPath}:`, err.message)
    return
  }

  const repoName = path.basename(repoPath)
  for (const entry of (log.all || [])) {
    const timestamp = new Date(entry.date).getTime()
    if (isNaN(timestamp)) continue

    let filesChanged = 0
    try {
      const diff = await git.diffSummary([`${entry.hash}^`, entry.hash])
      filesChanged = diff.files.length
    } catch { filesChanged = 0 }

    const d = new Date(timestamp)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const sessions = db.getSessionsForDate(dateStr)
    let bestSession = null, bestDiff = Infinity

    for (const s of sessions) {
      if (s.project !== repoName) continue
      const diff = Math.abs(timestamp - s.start_time)
      if (diff < bestDiff) { bestDiff = diff; bestSession = s }
    }

    db.insertCommit({
      repo: repoName, hash: entry.hash, message: entry.message,
      author: entry.author_name, timestamp, files_changed: filesChanged,
      session_id: bestSession ? bestSession.id : null,
    })
  }
}

async function collectAll() {
  const repos = db.getWatchedRepos()
  for (const repo of repos) {
    await collectFromRepo(repo.path).catch(console.error)
  }
}

function scheduleCollection() {
  collectAll().catch(console.error)
  collectInterval = setInterval(() => collectAll().catch(console.error), INTERVAL_MS)
  console.log('[Git] Scheduled collection every 30 min.')
}

function stopCollection() {
  if (collectInterval) { clearInterval(collectInterval); collectInterval = null }
}

module.exports = { collectFromRepo, collectAll, scheduleCollection, stopCollection }
