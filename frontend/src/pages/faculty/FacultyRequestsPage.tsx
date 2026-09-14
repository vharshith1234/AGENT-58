import { useEffect, useMemo, useState } from 'react'
import { PageHeader, Panel, useApiData } from '../../components/DashboardShell'
import { api } from '../../lib/api'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

type RequestKind = 'leave' | 'reassignment' | 'correction' | 'other'

type ViewRow = {
  id: string
  kind: RequestKind
  typeLabel: string
  date: string
  submittedOn: string
  status: string
  description: string
  decision: string
  raw: any
}

function statusBadge(status: string) {
  const s = status.toUpperCase()
  const label =
    s === 'APPROVED' || s === 'ACCEPTED' ? 'Approved' : s === 'REJECTED' ? 'Rejected' : 'Pending'
  const cls =
    label === 'Approved'
      ? 'faculty-req-badge is-approved'
      : label === 'Rejected'
        ? 'faculty-req-badge is-rejected'
        : 'faculty-req-badge is-pending'
  return <span className={cls}>{label}</span>
}

/** Faculty Requests — compact UI over existing reassignment/correction APIs. */
export function FacultyRequestsPage() {
  const today = useApiData(() => api<any[]>(`/faculty/me/today?date=${todayIso()}`))
  const mine = useApiData(() => api<any[]>('/faculty/me/reassignments'))
  const corrections = useApiData(() => api<any[]>('/faculty/me/corrections'))

  const [requestType, setRequestType] = useState<RequestKind>('leave')
  const [slotId, setSlotId] = useState('')
  const [hours, setHours] = useState('1')
  const [requestDate, setRequestDate] = useState(todayIso())
  const [reason, setReason] = useState('')
  const [toFacultyId, setToFacultyId] = useState('')
  const [facultySearch, setFacultySearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [confirmFlash, setConfirmFlash] = useState(false)
  const [busy, setBusy] = useState(false)
  const [category, setCategory] = useState('Teaching hours')
  const [viewRow, setViewRow] = useState<ViewRow | null>(null)

  const todaySlots = today.data || []
  const selectedSlot = todaySlots.find((s: any) => s.id === slotId) || null

  useEffect(() => {
    if (selectedSlot?.durationHrs) setHours(String(selectedSlot.durationHrs))
  }, [selectedSlot?.id, selectedSlot?.durationHrs])

  useEffect(() => {
    if (slotId && todaySlots.length && !todaySlots.some((s: any) => s.id === slotId)) {
      setSlotId('')
      setToFacultyId('')
    }
  }, [todaySlots, slotId])

  useEffect(() => {
    setSlotId('')
    setToFacultyId('')
    setFacultySearch('')
    setMessage(null)
  }, [requestType])

  const candidates = useApiData(() => {
    if (requestType !== 'reassignment') {
      return Promise.resolve({ byCourse: [], byLoad: [], recommended: [] })
    }
    const q = new URLSearchParams({ hours: hours || '1' })
    if (selectedSlot?.courseId) q.set('courseId', selectedSlot.courseId)
    return api<any>(`/faculty/me/reassignment-candidates?${q.toString()}`)
  }, [hours, selectedSlot?.courseId, requestType])

  const candidateList = useMemo(() => {
    const byId = new Map<string, any>()
    for (const c of [
      ...(candidates.data?.byCourse || []),
      ...(candidates.data?.byLoad || []),
      ...(candidates.data?.recommended || []),
    ]) {
      if (c?.facultyId) byId.set(c.facultyId, c)
    }
    const q = facultySearch.trim().toLowerCase()
    return Array.from(byId.values())
      .filter((c) => !q || String(c.name || '').toLowerCase().includes(q))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  }, [candidates.data, facultySearch])

  const selectedFaculty = candidateList.find((c) => c.facultyId === toFacultyId) || null

  const myRows = useMemo(() => {
    const rows: ViewRow[] = []
    for (const r of mine.data || []) {
      const statusRaw = String(r.status || 'PENDING')
      const status =
        statusRaw === 'PENDING_UTESH' ? 'PENDING' : statusRaw === 'ACCEPTED' ? 'APPROVED' : statusRaw
      rows.push({
        id: `rea-${r.id}`,
        kind: 'reassignment',
        typeLabel: 'Reassignment / Work Transfer',
        date: r.date ? String(r.date).slice(0, 10) : '—',
        submittedOn: r.createdAt ? new Date(r.createdAt).toLocaleString() : '—',
        status,
        description: [
          r.reason,
          r.toFaculty?.name ? `→ ${r.toFaculty.name}` : '',
          r.hours != null ? `(${r.hours}h)` : '',
        ]
          .filter(Boolean)
          .join(' '),
        decision:
          statusRaw === 'ACCEPTED'
            ? `Approved${r.decidedBy?.name ? ` · ${r.decidedBy.name}` : ''}`
            : statusRaw === 'REJECTED'
              ? `Rejected${r.rejectionReason ? ` · ${r.rejectionReason}` : ''}`
              : 'Awaiting HR',
        raw: r,
      })
    }
    for (const c of corrections.data || []) {
      const cat = String(c.issueCategory || 'Correction')
      const lower = cat.toLowerCase()
      const kind: RequestKind =
        lower === 'leave' ? 'leave' : lower === 'other' ? 'other' : 'correction'
      const typeLabel =
        kind === 'leave'
          ? 'Leave'
          : kind === 'other'
            ? 'Other'
            : cat.startsWith('Correction')
              ? cat
              : `Correction · ${cat}`
      rows.push({
        id: `corr-${c.id}`,
        kind,
        typeLabel,
        date: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—',
        submittedOn: c.createdAt ? new Date(c.createdAt).toLocaleString() : '—',
        status: String(c.status || 'PENDING').toUpperCase(),
        description: c.description || '—',
        decision:
          c.status === 'PENDING'
            ? 'Awaiting HR'
            : c.resolutionNote ||
              (c.status === 'APPROVED' ? 'Approved' : c.status === 'REJECTED' ? 'Rejected' : '—'),
        raw: c,
      })
    }
    return rows.sort((a, b) => {
      const ta = new Date(a.raw?.createdAt || a.raw?.date || 0).getTime()
      const tb = new Date(b.raw?.createdAt || b.raw?.date || 0).getTime()
      return tb - ta
    })
  }, [mine.data, corrections.data])

  function flashConfirm(text: string) {
    setMessage(text)
    setConfirmFlash(true)
    window.setTimeout(() => setConfirmFlash(false), 3500)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (requestType === 'reassignment') {
      if (!selectedSlot?.id) {
        setMessage('Select today’s class to transfer.')
        return
      }
      if (!toFacultyId) {
        setMessage('Select a receiving faculty.')
        return
      }
      setBusy(true)
      try {
        await api('/faculty/me/reassignments', {
          method: 'POST',
          body: JSON.stringify({
            date: requestDate || todayIso(),
            reason: reason.trim() || 'Work transfer',
            toFacultyId,
            timetableSlotId: selectedSlot.id,
            hours: Number(selectedSlot.durationHrs || hours || 1),
            courseId: selectedSlot.courseId,
            startTime: selectedSlot.startTime,
            endTime: selectedSlot.endTime,
            section: selectedSlot.batchLabel || selectedSlot.course?.section,
          }),
        })
        setToFacultyId('')
        setSlotId('')
        setReason('')
        flashConfirm('Request submitted. HR will review it shortly.')
        await mine.reload()
      } catch (err: any) {
        setMessage(err.message || 'Submit failed')
      } finally {
        setBusy(false)
      }
      return
    }

    if (!reason.trim()) {
      setMessage('Please enter a reason / description.')
      return
    }

    const issueCategory =
      requestType === 'leave' ? 'Leave' : requestType === 'other' ? 'Other' : category || 'Teaching hours'

    const descParts = [reason.trim()]
    if (requestType === 'leave' || requestType === 'other') {
      if (requestDate) descParts.push(`Date: ${requestDate}`)
      if (hours) descParts.push(`Hours: ${hours}`)
    }

    setBusy(true)
    try {
      await api('/faculty/me/corrections', {
        method: 'POST',
        body: JSON.stringify({
          issueCategory,
          description: descParts.join(' · '),
          currentValue: requestType === 'leave' ? hours || '' : '',
          expectedValue: requestDate || '',
          targetRole: 'HOD',
        }),
      })
      setReason('')
      flashConfirm('Request submitted. HR will review it shortly.')
      await corrections.reload()
    } catch (err: any) {
      setMessage(err.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  const typeOptions: { id: RequestKind; label: string }[] = [
    { id: 'leave', label: 'Leave' },
    { id: 'reassignment', label: 'Reassignment / Work Transfer' },
    { id: 'correction', label: 'Correction' },
    { id: 'other', label: 'Other' },
  ]

  return (
    <div className="faculty-requests-page">
      <PageHeader title="Requests" subtitle="Submit a request and track its status." />

      {message && (
        <div className={`alert-banner${confirmFlash ? ' faculty-req-confirm' : ''}`}>{message}</div>
      )}

      <form className="faculty-req-form" onSubmit={(e) => void submit(e)}>
        <Panel title="1. Request Type">
          <div className="faculty-req-type-grid">
            {typeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`faculty-req-type-btn${requestType === opt.id ? ' is-active' : ''}`}
                onClick={() => setRequestType(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="2. Request Details">
          <div className="faculty-req-details">
            <label className="field-label">
              <span>Reason / Description</span>
              <textarea
                className="dash-input"
                rows={3}
                required
                placeholder="Briefly describe your request"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>

            <div className="faculty-req-inline">
              <label className="field-label">
                <span>Date</span>
                <input
                  type="date"
                  className="dash-input"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                />
              </label>

              {(requestType === 'leave' ||
                requestType === 'reassignment' ||
                requestType === 'other') && (
                <label className="field-label">
                  <span>Hours</span>
                  <input
                    className="dash-input"
                    inputMode="decimal"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                  />
                </label>
              )}

              {requestType === 'correction' && (
                <label className="field-label">
                  <span>Correction category</span>
                  <select
                    className="dash-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option>Teaching hours</option>
                    <option>Project credit</option>
                    <option>Admin role</option>
                    <option>Other</option>
                  </select>
                </label>
              )}
            </div>

            {requestType === 'reassignment' && (
              <div className="faculty-req-reassign">
                <label className="field-label">
                  <span>Today’s Classes</span>
                  <select
                    className="dash-input"
                    value={slotId}
                    onChange={(e) => {
                      setSlotId(e.target.value)
                      setToFacultyId('')
                      setFacultySearch('')
                    }}
                  >
                    <option value="">Select a class</option>
                    {todaySlots.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.startTime}–{s.endTime} · {s.course?.code || s.course?.name || 'Class'}
                        {s.batchLabel ? ` · Sec ${s.batchLabel}` : ''}
                        {s.durationHrs != null ? ` · ${s.durationHrs}h` : ''}
                      </option>
                    ))}
                  </select>
                  {!today.loading && todaySlots.length === 0 && (
                    <span className="faculty-req-hint">No classes listed for today.</span>
                  )}
                </label>

                {slotId ? (
                  <label className="field-label">
                    <span>Receiving faculty</span>
                    <input
                      className="dash-input"
                      placeholder="Search faculty"
                      value={facultySearch}
                      onChange={(e) => setFacultySearch(e.target.value)}
                    />
                    <select
                      className="dash-input"
                      value={toFacultyId}
                      onChange={(e) => setToFacultyId(e.target.value)}
                      style={{ marginTop: '0.4rem' }}
                    >
                      <option value="">Select faculty</option>
                      {candidateList.map((c: any) => (
                        <option key={c.facultyId} value={c.facultyId}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {candidates.loading && <span className="faculty-req-hint">Loading faculty…</span>}
                    {!candidates.loading && candidateList.length === 0 && (
                      <span className="faculty-req-hint">No matching faculty.</span>
                    )}
                  </label>
                ) : null}

                {selectedFaculty ? (
                  <div className="faculty-req-workload">
                    <strong>{selectedFaculty.name}</strong>
                    <span>
                      {Number(selectedFaculty.current).toFixed(1)}h →{' '}
                      {Number(selectedFaculty.projected).toFixed(1)}h · {selectedFaculty.projectedStatus}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="3. Submit Request">
          <div className="faculty-req-submit-row">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit Request'}
            </button>
            {confirmFlash && <span className="faculty-req-submitted">Submitted successfully</span>}
          </div>
        </Panel>
      </form>

      <Panel title="My Requests" action={<span className="meta-chip">{myRows.length}</span>}>
        {myRows.length === 0 ? (
          <p className="empty-state">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Request Type</th>
                  <th>Date</th>
                  <th>Submitted On</th>
                  <th>Status</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {myRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.typeLabel}</td>
                    <td>{row.date}</td>
                    <td>{row.submittedOn}</td>
                    <td>{statusBadge(row.status)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setViewRow(row)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {viewRow && (
        <div
          className="profile-modal-backdrop"
          role="presentation"
          onClick={() => setViewRow(null)}
        >
          <div
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Request details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="faculty-req-modal-head">
              <h3>Request details</h3>
              {statusBadge(viewRow.status)}
            </div>
            <dl className="faculty-req-modal-dl">
              <div>
                <dt>Request Type</dt>
                <dd>{viewRow.typeLabel}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{viewRow.date}</dd>
              </div>
              <div>
                <dt>Submitted On</dt>
                <dd>{viewRow.submittedOn}</dd>
              </div>
              <div>
                <dt>Description</dt>
                <dd>{viewRow.description}</dd>
              </div>
              <div>
                <dt>HR Decision</dt>
                <dd>{viewRow.decision}</dd>
              </div>
            </dl>
            <div className="profile-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setViewRow(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
