import { useState, useRef, useEffect } from 'react'

export default function ReportEditor({ value, onSave }) {
  const [text,   setText]   = useState(value || '')
  const [dirty,  setDirty]  = useState(false)
  const [saving, setSaving] = useState(false)
  const timer = useRef(null)

  // Sync if parent changes value (e.g. new generation)
  useEffect(() => {
    setText(value || '')
    setDirty(false)
  }, [value])

  function handleChange(e) {
    setText(e.target.value)
    setDirty(true)
    // Auto-save after 1.5 seconds of inactivity
    clearTimeout(timer.current)
    timer.current = setTimeout(() => autoSave(e.target.value), 1500)
  }

  async function autoSave(newText) {
    setSaving(true)
    await onSave(newText)
    setDirty(false)
    setSaving(false)
  }

  // Force-save on blur
  function handleBlur() {
    if (dirty) {
      clearTimeout(timer.current)
      autoSave(text)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Markdown report — edit freely, auto-saves on change
        </span>
        <span style={{ fontSize: 11, color: saving ? 'var(--accent)' : dirty ? '#f59e0b' : '#4ade80' }}>
          {saving ? '💾 Saving…' : dirty ? '● Unsaved' : '✓ Saved'}
        </span>
      </div>
      <textarea
        className="report-textarea"
        style={{ height: 'calc(100vh - 300px)' }}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        spellCheck={false}
        placeholder="Your daily report will appear here after generation…"
      />
    </div>
  )
}
