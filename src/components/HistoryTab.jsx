import { useState, useEffect, useCallback } from 'react'
import ReportEditor from './ReportEditor'

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function firstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay() // 0=Sun
}
function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAYS_OF_WEEK = ['Su','Mo','Tu','We','Th','Fr','Sa']

export default function HistoryTab() {
  const now = new Date()
  const [viewYear,  setViewYear]  = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selected,  setSelected]  = useState(todayStr())
  const [reportDates, setReportDates] = useState(new Set())
  const [report,    setReport]    = useState(null)
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    window.devtracker?.getReportDates().then(dates => {
      setReportDates(new Set(dates))
    }).catch(() => {})
  }, [])

  const loadReport = useCallback(async (dateStr) => {
    setLoading(true)
    setReport(null)
    try {
      const r = await window.devtracker?.getReport(dateStr)
      setReport(r ? r.content : null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selected) loadReport(selected)
  }, [selected, loadReport])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const totalDays  = daysInMonth(viewYear, viewMonth)
  const firstDay   = firstDayOfMonth(viewYear, viewMonth)
  const today      = todayStr()

  async function handleSave(content) {
    await window.devtracker?.saveReport(selected, content)
    setReport(content)
    setReportDates(prev => new Set([...prev, selected]))
  }

  return (
    <div className="fade-in" style={{ padding: '28px 32px', display: 'flex', gap: 28, height: '100%' }}>

      {/* ── Calendar panel ──────────────────────────────────────────────────── */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
          History
        </h2>

        <div className="glass" style={{ padding: 16 }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 14 }} onClick={prevMonth}>‹</button>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#e2e8f0' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 14 }} onClick={nextMonth}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS_OF_WEEK.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e-${i}`} className="cal-day empty" />
            ))}
            {/* Actual days */}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
              const dateStr = toDateStr(viewYear, viewMonth, day)
              const isToday    = dateStr === today
              const hasReport  = reportDates.has(dateStr)
              const isSelected = dateStr === selected
              const isFuture   = dateStr > today

              let cls = 'cal-day'
              if (isSelected) cls += ' selected'
              else if (hasReport) cls += ' has-report'
              if (isToday) cls += ' today'
              if (isFuture) cls += ' empty'

              return (
                <div
                  key={day}
                  className={cls}
                  style={{ textAlign: 'center' }}
                  onClick={() => !isFuture && setSelected(dateStr)}
                  title={hasReport ? `Report available for ${dateStr}` : undefined}
                >
                  {day}
                  {hasReport && !isSelected && (
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', margin: '0 auto', marginTop: 1 }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ marginTop: 14, display: 'flex', gap: 12, fontSize: 10, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--accent)' }}>■</span> Has report
            <span style={{ border: '1px solid rgba(0,210,255,0.35)', borderRadius: 3, padding: '0 4px' }}>Today</span>
          </div>
        </div>
      </div>

      {/* ── Report panel ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
          {selected}
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div className="spin" style={{ fontSize: 24, display: 'inline-block', marginBottom: 12 }}>◌</div>
            <div>Loading report…</div>
          </div>
        ) : report ? (
          <ReportEditor value={report} onSave={handleSave} />
        ) : (
          <div className="glass" style={{ textAlign: 'center', padding: '60px 32px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
              No report for this date.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
