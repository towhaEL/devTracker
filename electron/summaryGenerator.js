const db = require('./db')

// ─── Template-based summary ───────────────────────────────────────────────────

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDateLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function buildTemplateReport(dateStr, sessions, commits) {
  if (sessions.length === 0) {
    return `## Daily Summary — ${formatDateLabel(dateStr)}\n\n_No coding sessions recorded today._\n`
  }

  // Group by project
  const byProject = {}
  for (const s of sessions) {
    if (!byProject[s.project]) byProject[s.project] = { sessions: [], commits: [] }
    byProject[s.project].sessions.push(s)
  }
  for (const c of commits) {
    if (!byProject[c.repo]) byProject[c.repo] = { sessions: [], commits: [] }
    byProject[c.repo].commits.push(c)
  }

  const totalMs = sessions.reduce((sum, s) => {
    return sum + ((s.end_time || Date.now()) - s.start_time)
  }, 0)

  let report = `## Daily Summary — ${formatDateLabel(dateStr)}\n`
  report += `**Total coding time:** ${formatDuration(totalMs)}\n\n`
  report += `---\n\n`

  for (const [project, data] of Object.entries(byProject)) {
    const projectMs = data.sessions.reduce((sum, s) => {
      return sum + ((s.end_time || Date.now()) - s.start_time)
    }, 0)

    report += `### ${project}  _(${formatDuration(projectMs)})_\n\n`

    // Build a combined timeline of sessions and commits, sorted by time
    const timeline = []
    for (const s of data.sessions) {
      timeline.push({ time: s.start_time, type: 'session-start', data: s })
      if (s.end_time) timeline.push({ time: s.end_time, type: 'session-end', data: s })
    }
    for (const c of data.commits) {
      timeline.push({ time: c.timestamp, type: 'commit', data: c })
    }
    timeline.sort((a, b) => a.time - b.time)

    for (const item of timeline) {
      const t = formatTime(item.time)
      if (item.type === 'session-start') {
        report += `- \`${t}\`  🟢 Session started (${item.data.event_count || 0} file saves)\n`
      } else if (item.type === 'session-end') {
        const dur = formatDuration(item.data.end_time - item.data.start_time)
        report += `- \`${t}\`  🔴 Session ended _(${dur})_\n`
      } else if (item.type === 'commit') {
        const files = item.data.files_changed
        report += `- \`${t}\`  📦 Committed: _"${item.data.message}"_`
        if (files > 0) report += ` (${files} file${files !== 1 ? 's' : ''})`
        report += `\n`
      }
    }
    report += `\n`
  }

  return report
}

// ─── Gemini AI enhancement ────────────────────────────────────────────────────

async function enhanceWithGemini(templateReport, apiKey) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  const prompt = `You are a developer productivity assistant. Below is a raw work log from an automated coding tracker. 

Rewrite it as a clean, professional daily standup-style summary. Keep the same structure (per-project sections) but:
- Write natural-language descriptions of what was worked on
- Keep timestamps  
- Keep all commit messages (verbatim, in quotes)
- Add a brief 1-sentence takeaway at the end
- Keep it concise and factual

RAW LOG:
${templateReport}

Return only the formatted markdown, no preamble.`

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const json = await res.json()
  return json.candidates?.[0]?.content?.parts?.[0]?.text || templateReport
}

// ─── Main entry ───────────────────────────────────────────────────────────────

async function generateForDate(dateStr) {
  const sessions = db.getSessionsForDate(dateStr)
  const commits  = db.getCommitsForDate(dateStr)

  const template = buildTemplateReport(dateStr, sessions, commits)

  const aiEnabled = db.getSetting('ai_summaries_enabled') === 'true'
  const apiKey    = db.getSetting('gemini_api_key') || ''

  let finalContent = template
  if (aiEnabled && apiKey.length > 10) {
    try {
      console.log('[Summary] Calling Gemini AI...')
      finalContent = await enhanceWithGemini(template, apiKey)
    } catch (err) {
      console.error('[Summary] Gemini failed, using template:', err.message)
      finalContent = template
    }
  }

  db.saveReport(dateStr, finalContent)
  return finalContent
}

module.exports = { generateForDate, buildTemplateReport }
