import { useState, useEffect } from 'react'

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

export default function SessionTimer() {
  const [sessions, setSessions] = useState([])
  const [tick, setTick]         = useState(0)

  useEffect(() => {
    // Load initial sessions
    window.devtracker?.getActiveSessions().then(setSessions).catch(() => {})

    // Listen for live updates from main process
    const unsub = window.devtracker?.onSessionsUpdated((updated) => setSessions(updated))

    // Tick every second to update elapsed time
    const interval = setInterval(() => setTick(t => t + 1), 1000)

    return () => {
      unsub?.()
      clearInterval(interval)
    }
  }, [])

  if (!sessions || sessions.length === 0) {
    return (
      <div
        style={{
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 4 }}>
          STATUS
        </div>
        <div style={{ fontSize: 12, color: '#4b5563', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#374151', display: 'inline-block' }} />
          Idle
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '10px 12px', borderRadius: 10,
        background: 'rgba(0,210,255,0.06)',
        border: '1px solid rgba(0,210,255,0.2)',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>
        ACTIVE SESSION{sessions.length > 1 ? 'S' : ''}
      </div>
      {sessions.map((s) => (
        <div key={s.sessionId} style={{ marginBottom: sessions.length > 1 ? 8 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span className="session-dot" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {s.project}
            </span>
          </div>
          <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)', fontWeight: 600 }}>
            {formatElapsed(Date.now() - s.startTime)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            {s.eventCount} file save{s.eventCount !== 1 ? 's' : ''}
          </div>
        </div>
      ))}
    </div>
  )
}
