import { useEffect, useMemo, useState } from 'react'
import {
  PageHeader,
  Panel,
  Stat,
  ErrorRetry,
  TableSkeleton,
  useApiData,
} from '../../components/DashboardShell'
import { StatusPill } from '../../components/PersonAvatar'
import { api } from '../../lib/api'
import { authService } from '../../lib/auth'
import {
  PreviousDataUnlockPanel,
  usePreviousDataUnlock,
} from '../../lib/previousDataUnlock'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Panel 1 — Uttej workload controller */
export function HrWorkloadControlPage() {
  const depts = useApiData(() => api<any[]>('/hr/departments'))
  const cse = (depts.data || []).find((d: any) => d.code === 'CSE')
  const cseId = cse?.id || ''
  const {
    unlocked,
    unlockInput,
    setUnlockInput,
    unlockMessage,
    tryUnlock,
    lockAgain,
  } = usePreviousDataUnlock()
  const [deptId, setDeptId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [assign, setAssign] = useState({
    facultyId: '',
    courseId: '',
    hours: '3',
    section: '',
  })

  useEffect(() => {
    if (!cseId) return
    if (!unlocked) setDeptId(cseId)
    else if (!deptId) setDeptId(cseId)
  }, [cseId, unlocked, deptId])

  const activeDeptId = unlocked ? deptId || cseId : cseId
  const overview = useApiData(
    () =>
      api<any>(
        activeDeptId
          ? `/hr/workload/overview?departmentId=${encodeURIComponent(activeDeptId)}`
          : '/hr/workload/overview',
      ),
    [activeDeptId],
  )
  const pending = useApiData(() => {
    const q = new URLSearchParams({ status: 'PENDING_UTESH' })
    if (activeDeptId) q.set('departmentId', activeDeptId)
    return api<any[]>(`/hr/reassignments?${q.toString()}`)
  }, [activeDeptId])

  const faculty = overview.data?.faculty || []
  const courseOptions = overview.data?.courses || []
  const filtered = useMemo(() => {
    if (!statusFilter) return faculty
    return faculty.filter((f: any) => f.status === statusFilter)
  }, [faculty, statusFilter])
  const banner = message || unlockMessage
  const visibleDepts = unlocked ? depts.data || [] : cse ? [cse] : []
  const activeDeptCode =
    visibleDepts.find((d: any) => d.id === activeDeptId)?.code || 'CSE'

  async function saveAssign(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!assign.facultyId || !assign.courseId) {
      setMessage('Select faculty and course before saving.')
      return
    }
    const hours = Number(assign.hours)
    if (!Number.isFinite(hours) || hours <= 0) {
      setMessage('Hours must be a positive number.')
      return
    }
    const departmentId = activeDeptId || overview.data?.departmentId || cseId
    if (!departmentId) {
      setMessage('Department not ready yet — wait a second and try again.')
      return
    }

    setBusy(true)
    try {
      const result = await api<any>('/hr/allocations', {
        method: 'POST',
        body: JSON.stringify({
          facultyId: assign.facultyId,
          courseId: assign.courseId,
          hours,
          section: assign.section || undefined,
          departmentId,
          confirmOverload: true,
          justification: 'Assigned by Uttej (Workload Controller)',
        }),
      })
      const after = result?.preCheck?.after
      const statusNote = after?.status ? ` · status ${after.status} (${Number(after.total).toFixed(1)}h)` : ''
      setMessage(`Allocation saved — workload recalculated${statusNote}.`)
      setAssign((a) => ({ ...a, courseId: '', hours: '3', section: '' }))
      await overview.reload()
      await pending.reload()
    } catch (err: any) {
      const detail =
        err?.body?.message?.message ||
        err?.body?.message ||
        err?.message ||
        'Assign failed'
      setMessage(typeof detail === 'string' ? detail : 'Assign failed — check faculty/course/department.')
    } finally {
      setBusy(false)
    }
  }

  async function accept(id: string) {
    setBusy(true)
    try {
      await api(`/hr/reassignments/${id}/accept`, { method: 'POST', body: '{}' })
      setMessage('Request accepted — timetable/workload updated.')
      await pending.reload()
      await overview.reload()
    } catch (e: any) {
      setMessage(e.message || 'Accept failed')
    } finally {
      setBusy(false)
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) {
      setMessage('Rejection reason is required.')
      return
    }
    setBusy(true)
    try {
      await api(`/hr/reassignments/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      setMessage('Request rejected.')
      setRejectId(null)
      setRejectReason('')
      await pending.reload()
    } catch (e: any) {
      setMessage(e.message || 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Workload Controller"
        subtitle={
          unlocked
            ? 'Unlocked — pick any department. Uttej assigns and Accept/Rejects.'
            : 'Uttej CSE-only mode. Unlock for other departments.'
        }
      />
      {banner && (
        <div
          className="alert-banner"
          style={
            /saved|accepted|recalculated/i.test(banner)
              ? { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }
              : /fail|error|required|unauthorized|overload|not ready/i.test(banner)
                ? { background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }
                : undefined
          }
        >
          {banner}
        </div>
      )}
      <ErrorRetry error={overview.error} onRetry={() => void overview.reload()} />

      {unlocked && (
        <Panel
          title="Department"
          action={
            <PreviousDataUnlockPanel
              unlocked={unlocked}
              unlockInput={unlockInput}
              setUnlockInput={setUnlockInput}
              onUnlock={tryUnlock}
              onLock={() => {
                lockAgain()
                if (cseId) setDeptId(cseId)
              }}
            />
          }
        >
          <label className="field-label">
            <span>Select department</span>
            <select
              className="dash-input"
              value={activeDeptId}
              onChange={(e) => {
                setDeptId(e.target.value)
                setAssign({ facultyId: '', courseId: '', hours: '3', section: '' })
              }}
            >
              {visibleDepts.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.code} · {d.name}
                </option>
              ))}
            </select>
          </label>
        </Panel>
      )}
      {!unlocked ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <PreviousDataUnlockPanel
            unlocked={unlocked}
            unlockInput={unlockInput}
            setUnlockInput={setUnlockInput}
            onUnlock={tryUnlock}
            onLock={() => {
              lockAgain()
              if (cseId) setDeptId(cseId)
            }}
          />
        </div>
      ) : null}

      <div className="stat-grid">
        <Stat label="Faculty" value={overview.data?.stats?.total ?? '—'} />
        <Stat label="Normal" value={overview.data?.stats?.normal ?? '—'} />
        <Stat label="Underload" value={overview.data?.stats?.underload ?? '—'} />
        <Stat label="Overload" value={overview.data?.stats?.overload ?? '—'} />
        <Stat label="Pending requests" value={(pending.data || []).length} />
      </div>

      <Panel title="Assign workload">
        <form className="form-grid" onSubmit={(e) => void saveAssign(e)}>
          <label className="field-label">
            <span>Faculty</span>
            <select
              className="dash-input"
              required
              value={assign.facultyId}
              onChange={(e) => setAssign({ ...assign, facultyId: e.target.value })}
            >
              <option value="">Select faculty</option>
              {faculty.map((f: any) => (
                <option key={f.facultyId} value={f.facultyId}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Course</span>
            <select
              className="dash-input"
              required
              value={assign.courseId}
              onChange={(e) => setAssign({ ...assign, courseId: e.target.value })}
            >
              <option value="">Select course</option>
              {courseOptions.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Hours</span>
            <input
              className="dash-input"
              value={assign.hours}
              onChange={(e) => setAssign({ ...assign, hours: e.target.value })}
              required
            />
          </label>
          <label className="field-label">
            <span>Section</span>
            <input
              className="dash-input"
              value={assign.section}
              onChange={(e) => setAssign({ ...assign, section: e.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy || !assign.facultyId || !assign.courseId}>
              {busy ? 'Saving…' : 'Save assignment'}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Pending reassignment requests" action={<span className="meta-chip">{(pending.data || []).length}</span>}>
        {(pending.data || []).length === 0 && <p className="empty-state">No pending requests.</p>}
        <div className="balance-suggestions">
          {(pending.data || []).map((r: any) => (
            <div key={r.id} className="balance-suggestion-card">
              <div className="balance-suggestion-move">
                <div className="balance-suggestion-party">
                  <span className="balance-suggestion-label">From</span>
                  <strong>{r.fromFaculty?.name}</strong>
                  <span className="balance-suggestion-nums">
                    {Number(r.fromBefore).toFixed(1)}h → {Number(r.fromAfter).toFixed(1)}h ({r.fromStatusAfter})
                  </span>
                </div>
                <div className="balance-suggestion-arrow">→ {r.hours}h</div>
                <div className="balance-suggestion-party">
                  <span className="balance-suggestion-label">To</span>
                  <strong>{r.toFaculty?.name}</strong>
                  <span className="balance-suggestion-nums">
                    {Number(r.toBefore).toFixed(1)}h → {Number(r.toAfter).toFixed(1)}h ({r.toStatusAfter})
                  </span>
                </div>
              </div>
              <p className="balance-suggestion-reason">
                {r.date?.slice?.(0, 10)} {r.startTime || ''}–{r.endTime || ''} · {r.reason}
              </p>
              {rejectId === r.id ? (
                <div className="form-grid form-grid-stacked">
                  <label className="field-label">
                    <span>Rejection reason</span>
                    <input
                      className="dash-input"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Why reject?"
                    />
                  </label>
                  <div className="form-actions" style={{ gap: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setRejectId(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void reject(r.id)}>
                      Confirm reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="balance-suggestion-actions" style={{ gap: '0.5rem' }}>
                  <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setRejectId(r.id)}>
                    Reject
                  </button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void accept(r.id)}>
                    Accept
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title={`${activeDeptCode} faculty workload`}
        action={
          <select className="dash-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="UNDERLOAD">Underload</option>
            <option value="NORMAL">Normal</option>
            <option value="OVERLOAD">Overload</option>
          </select>
        }
      >
        {overview.loading && <TableSkeleton />}
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Total</th>
              <th>Norm</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f: any) => (
              <tr key={f.facultyId}>
                <td>{f.name}</td>
                <td>{Number(f.total).toFixed(1)}h</td>
                <td>
                  {f.normMin}–{f.normMax}
                </td>
                <td>
                  <StatusPill status={f.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  )
}

/** Faculty customer — leave + transfer + corrections */
export function FacultyLeaveReassignPage() {
  const [tab, setTab] = useState<'leave' | 'corrections'>('leave')
  const today = useApiData(() => api<any[]>(`/faculty/me/today?date=${todayIso()}`))
  const mine = useApiData(() => api<any[]>('/faculty/me/reassignments'))
  const corrections = useApiData(() => api<any[]>('/faculty/me/corrections'))
  const [slotId, setSlotId] = useState('')
  const [hours, setHours] = useState('1')
  const [reason, setReason] = useState('Personal Leave')
  const [toFacultyId, setToFacultyId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [category, setCategory] = useState('Teaching hours')
  const [description, setDescription] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [expectedValue, setExpectedValue] = useState('')

  const todaySlots = today.data || []
  const selectedSlot = todaySlots.find((s: any) => s.id === slotId) || null
  const dayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  useEffect(() => {
    if (selectedSlot?.durationHrs) setHours(String(selectedSlot.durationHrs))
  }, [selectedSlot?.id, selectedSlot?.durationHrs])

  // Clear selection if today's list reloads and slot is gone
  useEffect(() => {
    if (slotId && todaySlots.length && !todaySlots.some((s: any) => s.id === slotId)) {
      setSlotId('')
    }
  }, [todaySlots, slotId])

  const candidates = useApiData(() => {
    const q = new URLSearchParams({ hours: hours || '1' })
    if (selectedSlot?.courseId) q.set('courseId', selectedSlot.courseId)
    return api<any>(`/faculty/me/reassignment-candidates?${q.toString()}`)
  }, [hours, selectedSlot?.courseId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSlot?.id) {
      setMessage('Select one of today’s classes to transfer.')
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
          date: todayIso(),
          reason,
          toFacultyId,
          timetableSlotId: selectedSlot.id,
          hours: Number(selectedSlot.durationHrs || hours || 1),
          courseId: selectedSlot.courseId,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          section: selectedSlot.batchLabel || selectedSlot.course?.section,
        }),
      })
      setMessage('Request sent to HR. You can track status below.')
      setToFacultyId('')
      await mine.reload()
    } catch (err: any) {
      setMessage(err.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/faculty/me/corrections', {
        method: 'POST',
        body: JSON.stringify({
          issueCategory: category,
          description,
          currentValue,
          expectedValue,
          targetRole: 'HOD',
        }),
      })
      setDescription('')
      setCurrentValue('')
      setExpectedValue('')
      setMessage('Correction submitted.')
      await corrections.reload()
    } catch (err: any) {
      setMessage(err.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle={
          tab === 'leave'
            ? `Submit leave / work transfer for today — ${dayLabel}. Status updates after HR decision.`
            : 'Submit workload corrections. Track Pending / Approved / Rejected status.'
        }
        action={
          <div className="hod-view-toggle">
            <button
              type="button"
              className={tab === 'leave' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => setTab('leave')}
            >
              Leave / Reassignment
            </button>
            <button
              type="button"
              className={tab === 'corrections' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => setTab('corrections')}
            >
              Corrections
            </button>
          </div>
        }
      />
      {message && <div className="alert-banner">{message}</div>}

      {tab === 'leave' && (
        <>
          <div className="admin-committees-grid">
            <Panel title="Today’s classes">
              {today.loading && <p className="empty-state">Loading today’s timetable…</p>}
              {!today.loading && todaySlots.length === 0 && (
                <p className="empty-state">
                  No classes scheduled for today ({dayLabel.split(',')[0]}). Same-course recommendations appear
                  only when you have a real class today — try again on a teaching day.
                </p>
              )}
              <ul className="role-roster">
                {todaySlots.map((s: any) => (
                  <li key={s.id} className="role-roster-item">
                    <label className="role-roster-row" style={{ cursor: 'pointer', width: '100%' }}>
                      <input
                        type="radio"
                        name="slot"
                        checked={slotId === s.id}
                        onChange={() => {
                          setSlotId(s.id)
                          setHours(String(s.durationHrs || 1))
                        }}
                      />
                      <div className="role-roster-main">
                        <strong>
                          {s.startTime}–{s.endTime} · {s.course?.name || s.course?.code}
                        </strong>
                        <span className="role-roster-sub">
                          {s.durationHrs}h · {s.course?.code || '—'} · section {s.batchLabel || '—'}
                        </span>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Create request">
              <form className="form-grid form-grid-stacked" onSubmit={(e) => void submit(e)}>
                <label className="field-label">
                  <span>Request type</span>
                  <input className="dash-input" value="Leave / Reassignment" readOnly />
                </label>
                <label className="field-label">
                  <span>Reason / description</span>
                  <input className="dash-input" value={reason} onChange={(e) => setReason(e.target.value)} required />
                </label>
                <label className="field-label">
                  <span>Hours</span>
                  <input className="dash-input" value={hours} onChange={(e) => setHours(e.target.value)} />
                </label>
                <div className="field-label">
                  <span>
                    Pick receiving faculty
                    {selectedSlot?.course
                      ? ` · for ${selectedSlot.course.code || selectedSlot.course.name}`
                      : ' · select today’s class first'}
                  </span>
                  <div className="admin-committees-grid" style={{ marginTop: '0.5rem' }}>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>
                        Same course / subject (academic fit)
                      </strong>
                      <ul className="role-roster">
                        {(candidates.data?.byCourse || []).slice(0, 8).map((c: any) => (
                          <li key={`course-${c.facultyId}`} className="role-roster-item is-under">
                            <label className="role-roster-row" style={{ cursor: 'pointer', width: '100%' }}>
                              <input
                                type="radio"
                                name="to"
                                checked={toFacultyId === c.facultyId}
                                onChange={() => setToFacultyId(c.facultyId)}
                              />
                              <div className="role-roster-main">
                                <strong>{c.name}</strong>
                                <span className="role-roster-sub">
                                  {c.sameCourse ? 'Same course' : 'Same subject'} · {c.current.toFixed(1)} →{' '}
                                  {c.projected.toFixed(1)}h · {c.projectedStatus}
                                </span>
                              </div>
                            </label>
                          </li>
                        ))}
                        {!candidates.loading && (candidates.data?.byCourse || []).length === 0 && (
                          <li className="empty-state">
                            {selectedSlot?.courseId
                              ? 'No other faculty currently teaching this course/subject (within load).'
                              : 'Select today’s class to find same-course faculty.'}
                          </li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>
                        By workload (capacity fit)
                      </strong>
                      <ul className="role-roster">
                        {(candidates.data?.byLoad || candidates.data?.recommended || []).slice(0, 8).map((c: any) => (
                          <li key={`load-${c.facultyId}`} className="role-roster-item is-under">
                            <label className="role-roster-row" style={{ cursor: 'pointer', width: '100%' }}>
                              <input
                                type="radio"
                                name="to"
                                checked={toFacultyId === c.facultyId}
                                onChange={() => setToFacultyId(c.facultyId)}
                              />
                              <div className="role-roster-main">
                                <strong>{c.name}</strong>
                                <span className="role-roster-sub">
                                  {c.current.toFixed(1)} → {c.projected.toFixed(1)}h · {c.projectedStatus}
                                  {c.sameCourse ? ' · also same course' : c.sameSubject ? ' · also same subject' : ''}
                                </span>
                              </div>
                            </label>
                          </li>
                        ))}
                        {!candidates.loading &&
                          (candidates.data?.byLoad || candidates.data?.recommended || []).length === 0 && (
                            <li className="empty-state">
                              {selectedSlot
                                ? 'No faculty within load capacity right now.'
                                : 'Select today’s class first.'}
                            </li>
                          )}
                      </ul>
                    </div>
                  </div>
                  {(candidates.data?.best || []).length > 0 && selectedSlot?.courseId && (
                    <p className="empty-state" style={{ marginTop: '0.5rem' }}>
                      Best overall: <strong>{candidates.data.best[0].name}</strong>
                      {candidates.data.best[0].sameCourse
                        ? ' (same course + within load)'
                        : candidates.data.best[0].sameSubject
                          ? ' (same subject + within load)'
                          : ' (best capacity)'}
                    </p>
                  )}
                </div>
                {(candidates.data?.notRecommended || []).length > 0 && selectedSlot && (
                  <p className="empty-state">
                    Not recommended (would overload):{' '}
                    {(candidates.data.notRecommended as any[]).slice(0, 3).map((c) => c.name).join(', ')}
                  </p>
                )}
                <div className="form-actions">
                  <button className="btn btn-primary" type="submit" disabled={busy || !selectedSlot}>
                    Submit request
                  </button>
                </div>
              </form>
            </Panel>
          </div>
          <Panel title="My requests" action={<span className="meta-chip">{(mine.data || []).length}</span>}>
            {(mine.data || []).length === 0 ? (
              <p className="empty-state">No leave / reassignment requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table compact-table">
                  <thead>
                    <tr>
                      <th>Faculty</th>
                      <th>Request Type</th>
                      <th>Description</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>HR Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(mine.data || []).map((r: any) => {
                      const status = String(r.status || 'PENDING')
                      const decision =
                        status === 'ACCEPTED'
                          ? `Approved${r.decidedBy?.name ? ` · ${r.decidedBy.name}` : ''}`
                          : status === 'REJECTED'
                            ? `Rejected${r.rejectionReason ? ` · ${r.rejectionReason}` : ''}`
                            : 'Awaiting HR'
                      return (
                        <tr key={r.id}>
                          <td>{r.fromFaculty?.name || '—'}</td>
                          <td>Leave / Reassignment</td>
                          <td>
                            {r.reason}
                            {r.toFaculty?.name ? ` → ${r.toFaculty.name}` : ''}
                            {r.hours != null ? ` (${r.hours}h)` : ''}
                          </td>
                          <td>
                            {r.date
                              ? String(r.date).slice(0, 10)
                              : r.createdAt
                                ? new Date(r.createdAt).toLocaleDateString()
                                : '—'}
                          </td>
                          <td>
                            <StatusPill
                              status={
                                status === 'PENDING_UTESH'
                                  ? 'PENDING'
                                  : status === 'ACCEPTED'
                                    ? 'APPROVED'
                                    : status
                              }
                            />
                          </td>
                          <td>{decision}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'corrections' && (
        <div className="grid-2">
          <Panel title="Create correction">
            <form className="form-grid form-grid-stacked" onSubmit={(e) => void submitCorrection(e)}>
              <label className="field-label">
                <span>Request type</span>
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
              <label className="field-label">
                <span>Description</span>
                <textarea
                  className="dash-input"
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="field-label">
                <span>Current value</span>
                <input
                  className="dash-input"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                />
              </label>
              <label className="field-label">
                <span>Expected value</span>
                <input
                  className="dash-input"
                  value={expectedValue}
                  onChange={(e) => setExpectedValue(e.target.value)}
                />
              </label>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  Submit correction
                </button>
              </div>
            </form>
          </Panel>
          <Panel title="My corrections" action={<span className="meta-chip">{(corrections.data || []).length}</span>}>
            {(corrections.data || []).length === 0 ? (
              <p className="empty-state">No correction requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table compact-table">
                  <thead>
                    <tr>
                      <th>Request Type</th>
                      <th>Description</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>HR Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(corrections.data || []).map((c: any) => (
                      <tr key={c.id}>
                        <td>Correction · {c.issueCategory}</td>
                        <td>{c.description}</td>
                        <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <StatusPill status={c.status} />
                        </td>
                        <td>
                          {c.status === 'PENDING'
                            ? 'Awaiting HR'
                            : c.resolutionNote ||
                              (c.status === 'APPROVED'
                                ? 'Approved'
                                : c.status === 'REJECTED'
                                  ? 'Rejected'
                                  : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  )
}

/** HOD / Dean spy monitor */
export function ReassignmentMonitorPage({ role }: { role: 'HOD' | 'DEAN' }) {
  const base = role === 'HOD' ? '/hod' : '/dean'
  const list = useApiData(() => api<any[]>(`${base}/reassignments`))
  const stats = useApiData(() => api<any>(`${base}/reassignments/stats`))
  const session = authService.getSession()

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle={`${session?.user?.name || role} — monitor only. HR / Uttej Accepts or Rejects.`}
      />
      <div className="stat-grid">
        <Stat label="Total" value={stats.data?.total ?? '—'} />
        <Stat label="Pending Uttej" value={stats.data?.pending ?? '—'} />
        <Stat label="Accepted" value={stats.data?.accepted ?? '—'} />
        <Stat label="Rejected" value={stats.data?.rejected ?? '—'} />
      </div>
      <Panel title="Request history">
        <ErrorRetry error={list.error} onRetry={() => void list.reload()} />
        {list.loading && <TableSkeleton />}
        <table className="data-table">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Hours</th>
              <th>Status</th>
              <th>Decision</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {(list.data || []).map((r: any) => (
              <tr key={r.id}>
                <td>{r.fromFaculty?.name}</td>
                <td>{r.toFaculty?.name}</td>
                <td>{r.hours}h</td>
                <td>
                  <StatusPill status={r.status} />
                </td>
                <td>
                  {r.decidedBy?.name || '—'}
                  {r.decidedAt ? ` · ${String(r.decidedAt).slice(0, 16)}` : ''}
                  {r.rejectionReason ? ` · ${r.rejectionReason}` : ''}
                </td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(list.data || []).length === 0 && <p className="empty-state">No reassignment requests yet.</p>}
      </Panel>
    </>
  )
}
