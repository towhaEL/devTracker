import { useState } from 'react'
import TodayTab    from './components/TodayTab'
import HistoryTab  from './components/HistoryTab'
import SettingsTab from './components/SettingsTab'
import SessionTimer from './components/SessionTimer'

const NAV = [
  { id: 'today',    label: 'Today',    icon: '⚡' },
  { id: 'history',  label: 'History',  icon: '📅' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState('today')

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-900)' }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col"
        style={{
          width: 220,
          minWidth: 220,
          background: 'var(--surface-950)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
        {/* Title bar / drag region */}
        <div className="drag-region flex items-center gap-2 px-5 py-4" style={{ height: 52 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #00d2ff, #0066cc)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, flexShrink: 0,
            }}
          >🧭</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: '#e2e8f0' }}>
            DevTracker
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 pt-2 flex-1">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`tab-btn no-drag${tab === n.id ? ' active' : ''}`}
              onClick={() => setTab(n.id)}
            >
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        {/* Session timer at bottom */}
        <div className="px-3 pb-4 no-drag">
          <SessionTimer />
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          {tab === 'today'    && <TodayTab />}
          {tab === 'history'  && <HistoryTab />}
          {tab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  )
}
