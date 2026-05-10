import { useState, useEffect, useCallback } from 'react'
import ReportEditor from './ReportEditor'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateHeading(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export default function TodayTab() {
  const [report,    setReport]    = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [saved,     setSaved]     = useState(false)

  const loadTodayReport = useCallback(async () => {
    setLoading(true)
    try {
      const content = await window.devtracker?.getTodaySummary()
      setReport(content || null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTodayReport()
  }, [loadTodayReport])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const content = await window.devtracker?.generateReport(today())
      setReport(content)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    if (!report) return
    await window.devtracker?.copyToClipboard(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave(newContent) {
    await window.devtracker?.saveReport(today(), newContent)
    setReport(newContent)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="fade-in" style={{ padding: '28px 32px', maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em' }}>
            Today's Summary
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {formatDateHeading(today())}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {saved && (
            <span style={{ fontSize: 12, color: '#4ade80' }} className="pop-in">✓ Saved</span>
          )}
          <button className="btn-ghost" onClick={handleCopy} disabled={!report}>
            {copied ? <><span className="pop-in">✓</span> Copied!</> : '📋 Copy'}
          </button>
          <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating
              ? <><span className="spin" style={{ display: 'inline-block' }}>◌</span> Generating…</>
              : '⚡ Generate Report'
            }
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <StatsBar />

      {/* Report area */}
      <div style={{ marginTop: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div className="spin" style={{ fontSize: 24, display: 'inline-block', marginBottom: 12 }}>◌</div>
            <div>Loading…</div>
          </div>
        ) : report ? (
          <ReportEditor value={report} onSave={handleSave} />
        ) : (
          <EmptyState onGenerate={handleGenerate} generating={generating} />
        )}
      </div>
    </div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    window.devtracker?.getActiveSessions().then(setSessions).catch(() => {})
    const unsub = window.devtracker?.onSessionsUpdated(setSessions)
    return () => unsub?.()
  }, [])

  const totalEvents = sessions.reduce((s, x) => s + x.eventCount, 0)
  const totalMs = sessions.reduce((s, x) => s + x.elapsedMs, 0)
  const projects = sessions.length

  function fmtDur(ms) {
    const m = Math.floor(ms / 60000)
    const h = Math.floor(m / 60)
    if (h === 0) return `${m}m`
    return `${h}h ${m % 60}m`
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {[
        { label: 'Active Projects', value: projects, icon: '📁' },
        { label: 'Session Time',    value: fmtDur(totalMs), icon: '⏱️' },
        { label: 'File Saves',      value: totalEvents, icon: '💾' },
      ].map(stat => (
        <div
          key={stat.label}
          className="glass"
          style={{ flex: 1, padding: '14px 18px' }}
        >
          <div style={{ fontSize: 18, marginBottom: 4 }}>{stat.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>{stat.value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onGenerate, generating }) {
  return (
    <div
      className="glass"
      style={{ textAlign: 'center', padding: '64px 32px' }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>
        No report yet
      </h2>
      <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: 14 }}>
        DevTracker has been silently tracking your work.<br />
        Click below to generate today's summary.
      </p>
      <button className="btn-primary" onClick={onGenerate} disabled={generating}>
        {generating ? '⏳ Generating…' : '⚡ Generate Today\'s Report'}
      </button>
    </div>
  )
}
