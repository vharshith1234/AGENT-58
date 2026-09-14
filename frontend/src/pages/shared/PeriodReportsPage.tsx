import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PageHeader,
  Panel,
  ErrorRetry,
  TableSkeleton,
  paginate,
  Pager,
} from '../../components/DashboardShell'
import { StatusPill } from '../../components/PersonAvatar'
import { api, apiBlob, triggerDownload } from '../../lib/api'
import type { AppRole } from '../../lib/roles'
import { SECTION_CHOICES, formatSectionDisplay } from '../../lib/sections'

type ReportType = 'day' | 'week' | 'month' | 'year' | 'custom'

function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rangeForType(type: ReportType, anchorIso: string): { from: string; to: string } {
  const anchor = new Date(`${anchorIso}T00:00:00`)
  if (Number.isNaN(anchor.getTime())) {
    const today = isoDate(new Date())
    return { from: today, to: today }
  }
  if (type === 'day') {
    const d = isoDate(anchor)
    return { from: d, to: d }
  }
  if (type === 'week') {
    const day = anchor.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = new Date(anchor)
    start.setDate(anchor.getDate() + mondayOffset)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { from: isoDate(start), to: isoDate(end) }
  }
  if (type === 'month') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { from: isoDate(start), to: isoDate(end) }
  }
  if (type === 'year') {
    const start = new Date(anchor.getFullYear(), 0, 1)
    const end = new Date(anchor.getFullYear(), 11, 31)
    return { from: isoDate(start), to: isoDate(end) }
  }
  return { from: isoDate(anchor), to: isoDate(anchor) }
}

/** Reports — period-scoped preview + Generate dropdown (CSV / PDF). View/download for all roles. */
export function PeriodReportsPage({ role }: { role: AppRole }) {
  const isMonitor = role === 'HOD' || role === 'DEAN' || role === 'PRINCIPAL'
  const today = useMemo(() => isoDate(new Date()), [])
  const [reportType, setReportType] = useState<ReportType>('week')
  const [fromDate, setFromDate] = useState(() => rangeForType('week', today).from)
  const [toDate, setToDate] = useState(() => rangeForType('week', today).to)
  const [sectionFilter, setSectionFilter] = useState('ALL')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [preview, setPreview] = useState<{
    summary: any
    rows: any[]
    label: string
  } | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (reportType === 'custom') return
    const next = rangeForType(reportType, fromDate || today)
    setFromDate(next.from)
    setToDate(next.to)
    setPreview(null)
    setMenuOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-fill when type changes
  }, [reportType])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const queryParams = useMemo(() => {
    const q = new URLSearchParams({
      range: reportType,
      from: fromDate,
      to: toDate,
      date: fromDate,
    })
    if (sectionFilter !== 'ALL') q.set('section', sectionFilter)
    return q
  }, [reportType, fromDate, toDate, sectionFilter])

  const rows = preview?.rows || []
  const paged = paginate(rows, page, 10)

  function clearPreview() {
    setPreview(null)
    setMenuOpen(false)
    setPage(1)
  }

  function validateDates() {
    if (!fromDate || !toDate) {
      setMessage('From Date and To Date are required.')
      return false
    }
    if (toDate < fromDate) {
      setMessage('To Date must be on or after From Date.')
      return false
    }
    return true
  }

  async function ensurePreview() {
    const data = await api<any>(`/reports/cse/period/preview?${queryParams.toString()}`)
    setPreview(data)
    setPage(1)
    return data
  }

  async function loadPreview() {
    if (!validateDates()) return
    setBusy(true)
    setMessage(null)
    setError(null)
    setMenuOpen(false)
    try {
      const data = await ensurePreview()
      setMessage(
        `Preview ready for ${fromDate} → ${toDate}${
          sectionFilter !== 'ALL' ? ` · Section ${sectionFilter}` : ''
        } (${data.rows?.length || 0} rows).`,
      )
    } catch (e: any) {
      setError(e?.message || 'Preview failed')
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  async function openGenerateMenu() {
    if (!validateDates()) return
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      await ensurePreview()
      setMenuOpen(true)
      setMessage('Choose CSV or PDF — same rows as the preview.')
    } catch (e: any) {
      setError(e?.message || 'Generate failed')
      setMenuOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function download(format: 'csv' | 'pdf') {
    if (!validateDates()) return
    setBusy(true)
    setMessage(null)
    try {
      if (!preview) await ensurePreview()
      const q = new URLSearchParams(queryParams)
      q.set('format', format)
      const blob = await apiBlob(`/reports/cse/period?${q.toString()}`)
      const label = preview?.label || `${fromDate}_to_${toDate}`
      const sectionTag = sectionFilter === 'ALL' ? 'all' : `sec${sectionFilter}`
      triggerDownload(
        blob,
        `workload-${reportType}-${sectionTag}-${label}.${format === 'pdf' ? 'pdf' : 'csv'}`,
      )
      setMessage(`${format.toUpperCase()} downloaded for the current filters.`)
      setMenuOpen(false)
    } catch (e: any) {
      setMessage(e?.message || 'Download failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={
          isMonitor
            ? 'Preview and download department workload reports (view only — same report tools as HR).'
            : 'Choose period and section, preview the scoped rows, then download CSV or PDF.'
        }
      />
      {message && <div className="alert-banner">{message}</div>}
      <ErrorRetry error={error} onRetry={() => void loadPreview()} />

      <Panel
        title="Report settings"
        className={menuOpen ? 'report-settings-panel is-menu-open' : 'report-settings-panel'}
      >
        <div className="form-grid report-filter-grid">
          <label className="field-label">
            <span>Report Type</span>
            <select
              className="dash-input"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </label>
          <label className="field-label">
            <span>From Date</span>
            <input
              className="dash-input"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                clearPreview()
              }}
            />
          </label>
          <label className="field-label">
            <span>To Date</span>
            <input
              className="dash-input"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                clearPreview()
              }}
            />
          </label>
          <label className="field-label">
            <span>Section</span>
            <select
              className="dash-input"
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value)
                clearPreview()
              }}
            >
              <option value="ALL">All</option>
              {SECTION_CHOICES.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="report-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void loadPreview()}
          >
            {busy ? 'Loading…' : 'Preview Report'}
          </button>
          <div className="report-generate-wrap" ref={menuRef}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void openGenerateMenu()}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {busy ? 'Working…' : 'Generate Report ▾'}
            </button>
            {menuOpen ? (
              <div className="report-generate-menu" role="menu">
                <div className="report-generate-menu-label">Export format</div>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => void download('csv')}
                >
                  <span className="report-generate-item-title">CSV spreadsheet</span>
                  <span className="report-generate-item-desc">Open in Excel or Sheets</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => void download('pdf')}
                >
                  <span className="report-generate-item-title">PDF document</span>
                  <span className="report-generate-item-desc">Print-ready report</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel
        title="Report content"
        action={
          preview ? (
            <span className="meta-chip">
              {rows.length} rows · {fromDate} → {toDate}
            </span>
          ) : undefined
        }
      >
        {!preview && busy ? <TableSkeleton /> : null}
        {!preview && !busy ? (
          <p className="empty-state">
            Select dates/section, then click Preview Report to load period-scoped rows.
          </p>
        ) : null}
        {preview ? (
          <>
            <div className="report-table-wrap">
              <table className="data-table compact-table report-data-table">
                <thead>
                  <tr>
                    <th>Faculty Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Course</th>
                    <th>Section</th>
                    <th>Class Type</th>
                    <th>Hours</th>
                    <th>Required Hours</th>
                    <th>Total Assigned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((r: any, idx: number) => (
                    <tr key={`${r.facultyName}-${r.course}-${r.section}-${idx}`}>
                      <td className="report-col-name">{r.facultyName || '—'}</td>
                      <td>{r.department || '—'}</td>
                      <td>{r.designation || '—'}</td>
                      <td>{r.course || '—'}</td>
                      <td>{formatSectionDisplay(r.section)}</td>
                      <td>{r.classType || '—'}</td>
                      <td className="num-cell">{r.hours ?? '—'}</td>
                      <td className="num-cell">{r.requiredHours ?? '—'}</td>
                      <td className="num-cell">{r.totalAssignedHours ?? '—'}</td>
                      <td>
                        <StatusPill status={r.workloadStatus} />
                      </td>
                    </tr>
                  ))}
                  {paged.rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="empty-state">
                        No rows for this period / section.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
          </>
        ) : null}
      </Panel>
    </>
  )
}
