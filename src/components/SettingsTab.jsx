import { useState, useEffect } from 'react'

// ─── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <div className={`toggle-track ${on ? 'on' : ''}`} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <div className="toggle-thumb" />
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="glass" style={{ padding: '20px 24px', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────
function Row({ label, sub, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div className="no-drag">{children}</div>
    </div>
  )
}

export default function SettingsTab() {
  const [settings,   setSettings]   = useState({})
  const [repos,      setRepos]       = useState([])
  const [apiKey,     setApiKey]      = useState('')
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [gapMinutes, setGapMinutes] = useState(15)
  const [aiEnabled,  setAiEnabled]  = useState(false)
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [status,     setStatus]     = useState('')
  const [collecting, setCollecting] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const s = await window.devtracker?.getSettings().catch(() => ({}))
    const r = await window.devtracker?.getWatchedRepos().catch(() => [])
    setSettings(s || {})
    setRepos(r || [])
    setApiKey(s?.gemini_api_key || '')
    setGapMinutes(parseInt(s?.session_gap_minutes || '15', 10))
    setAiEnabled(s?.ai_summaries_enabled === 'true')
    setAutoLaunch(s?.autoLaunch === true || s?.autoLaunch === 'true')
  }

  async function save(key, val) {
    await window.devtracker?.saveSetting(key, val)
    setStatus('Settings saved')
    setTimeout(() => setStatus(''), 2000)
  }

  async function handleAddRepo() {
    const dir = await window.devtracker?.selectDirectory()
    if (!dir) return
    const updated = await window.devtracker?.addRepo(dir)
    setRepos(updated || [])
    setStatus('Directory added')
    setTimeout(() => setStatus(''), 2000)
  }

  async function handleRemoveRepo(id) {
    const updated = await window.devtracker?.removeRepo(id)
    setRepos(updated || [])
  }

  async function handleAutoLaunchToggle(val) {
    setAutoLaunch(val)
    await window.devtracker?.setAutoLaunch(val)
  }

  async function handleAiToggle(val) {
    setAiEnabled(val)
    await save('ai_summaries_enabled', String(val))
  }

  async function handleGapChange(val) {
    setGapMinutes(val)
    await save('session_gap_minutes', String(val))
  }

  async function handleApiKeySave() {
    await save('gemini_api_key', apiKey)
  }

  async function handleGitCollect() {
    setCollecting(true)
    await window.devtracker?.triggerGitCollect().catch(() => {})
    setCollecting(false)
    setStatus('Git commits collected')
    setTimeout(() => setStatus(''), 2000)
  }

  return (
    <div className="fade-in" style={{ padding: '28px 32px', maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.02em' }}>Settings</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Configure your workspace and preferences</p>
        </div>
        {status && (
          <span className="badge badge-teal pop-in">{status}</span>
        )}
      </div>

      {/* ── Watched Directories ──────────────────────────────────────────────── */}
      <Section title="Watched Directories">
        {repos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>
            No directories configured. Add a project folder to start tracking.
          </p>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {repos.map(repo => (
              <div
                key={repo.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', borderRadius: 8, marginBottom: 6,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{repo.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                    {repo.path}
                  </div>
                </div>
                <button
                  className="btn-ghost"
                  style={{ padding: '4px 10px', fontSize: 12, color: '#f87171', borderColor: 'rgba(248,113,113,0.2)' }}
                  onClick={() => handleRemoveRepo(repo.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <button className="btn-primary" style={{ width: '100%' }} onClick={handleAddRepo}>
          + Add Directory
        </button>
      </Section>

      {/* ── Session Detection ────────────────────────────────────────────────── */}
      <Section title="Session Detection">
        <Row
          label="Session gap threshold"
          sub={`A gap of ${gapMinutes} min or more ends the current session`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: 200 }}>
            <input
              type="range" min={5} max={60} step={5}
              value={gapMinutes}
              onChange={e => setGapMinutes(Number(e.target.value))}
              onMouseUp={e => handleGapChange(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', width: 36, textAlign: 'right' }}>
              {gapMinutes}m
            </span>
          </div>
        </Row>
      </Section>

      {/* ── AI Summaries ─────────────────────────────────────────────────────── */}
      <Section title="AI Summaries (Gemini)">
        <Row label="Enable AI-enhanced reports" sub="Uses Gemini 2.0 Flash to rewrite summaries in natural language">
          <Toggle on={aiEnabled} onChange={handleAiToggle} />
        </Row>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
            Gemini API Key{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank" rel="noreferrer"
              style={{ color: 'var(--accent)', fontSize: 11 }}
            >
              Get free key →
            </a>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={apiKeyVisible ? 'text' : 'password'}
              className="input"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="AIza…"
            />
            <button className="btn-ghost" style={{ flexShrink: 0 }} onClick={() => setApiKeyVisible(v => !v)}>
              {apiKeyVisible ? '🙈' : '👁'}
            </button>
            <button className="btn-primary" style={{ flexShrink: 0 }} onClick={handleApiKeySave}>
              Save
            </button>
          </div>
        </div>
      </Section>

      {/* ── Git ──────────────────────────────────────────────────────────────── */}
      <Section title="Git Integration">
        <Row label="Collect commits now" sub="Manually trigger a Git log pull from all watched repos">
          <button className="btn-ghost" onClick={handleGitCollect} disabled={collecting}>
            {collecting ? '⏳ Collecting…' : '🔄 Collect Now'}
          </button>
        </Row>
      </Section>

      {/* ── App ──────────────────────────────────────────────────────────────── */}
      <Section title="Application">
        <Row label="Launch at login" sub="Start DevTracker automatically when you log in">
          <Toggle on={autoLaunch} onChange={handleAutoLaunchToggle} />
        </Row>
      </Section>
    </div>
  )
}
