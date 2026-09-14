import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PageHeader,
  Panel,
  Stat,
  ErrorRetry,
  TableSkeleton,
  useApiData,
  paginate,
  Pager,
} from '../../components/DashboardShell'
import { StatusPill, PersonAvatar } from '../../components/PersonAvatar'
import { api, apiDelete, apiUpload, invalidateApiCache } from '../../lib/api'
import {
  PreviousDataUnlockPanel,
  usePreviousDataUnlock,
} from '../../lib/previousDataUnlock'
import {
  ClassTypeBadge,
  classTypeLabel,
  hoursLabel,
  workloadHoursFrom,
} from '../../lib/workloadHours'
import { SECTION_CHOICES, formatSectionDisplay, sectionMatchesFilter } from '../../lib/sections'
import { useWorkspaceBase, useIsMonitorWorkspace } from '../../lib/workspaceBase'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Sample timetable slots for empty UI — no Demo/Mock labels. */
const SAMPLE_TIMETABLE_SLOTS = [
  {
    id: 'sample-tt-mon-bda',
    isSample: true,
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '10:00',
    room: 'CSE-301',
    contactType: 'Theory',
    facultyId: 'sample-faculty-umadevi',
    faculty: { id: 'sample-faculty-umadevi', name: 'Dr. M Umadevi' },
    course: { code: 'Big Data Analytics', name: 'Big Data Analytics', section: '1' },
    batchLabel: '',
  },
  {
    id: 'sample-tt-tue-cn',
    isSample: true,
    dayOfWeek: 2,
    startTime: '10:00',
    endTime: '11:00',
    room: 'CSE-302',
    contactType: 'Theory',
    facultyId: 'sample-faculty-chinna',
    faculty: { id: 'sample-faculty-chinna', name: 'Dr. Chinna Gopi Simhadri' },
    course: { code: 'Computer Networks', name: 'Computer Networks', section: '2' },
    batchLabel: '',
  },
  {
    id: 'sample-tt-wed-ml',
    isSample: true,
    dayOfWeek: 3,
    startTime: '14:00',
    endTime: '15:00',
    room: 'CSE-303',
    contactType: 'Theory',
    facultyId: 'sample-faculty-prashant',
    faculty: { id: 'sample-faculty-prashant', name: 'Dr. Prashant Upadhyay' },
    course: { code: 'Machine Learning', name: 'Machine Learning', section: '3' },
    batchLabel: '',
  },
  {
    id: 'sample-tt-fri-mlops',
    isSample: true,
    dayOfWeek: 5,
    startTime: '11:00',
    endTime: '12:00',
    room: 'CSE-304',
    contactType: 'Laboratory',
    facultyId: 'sample-faculty-hitendra',
    faculty: { id: 'sample-faculty-hitendra', name: 'Mr. Hitendra Singh' },
    course: { code: 'MLOps', name: 'MLOps', section: '4' },
    batchLabel: '',
  },
] as const

function useHrDeptScope() {
  const depts = useApiData(() => api<any[]>('/hr/departments'))
  const cse = (depts.data || []).find((d: any) => d.code === 'CSE')
  const cseId = cse?.id || ''
  const unlock = usePreviousDataUnlock()
  const [deptId, setDeptId] = useState('')

  useEffect(() => {
    if (!cseId) return
    if (!unlock.unlocked) setDeptId(cseId)
    else if (!deptId) setDeptId(cseId)
  }, [cseId, unlock.unlocked, deptId])

  const activeDeptId = unlock.unlocked ? deptId || cseId : cseId
  const visibleDepts = unlock.unlocked ? depts.data || [] : cse ? [cse] : []

  return {
    depts,
    cse,
    cseId,
    deptId,
    setDeptId,
    activeDeptId,
    visibleDepts,
    ...unlock,
  }
}

function DeptSelectPanel({
  unlocked,
  activeDeptId,
  visibleDepts,
  onChange,
}: {
  unlocked: boolean
  activeDeptId: string
  visibleDepts: any[]
  onChange: (id: string) => void
}) {
  if (!unlocked) return null
  return (
    <Panel title="Department">
      <label className="field-label">
        <span>Select department</span>
        <select
          className="dash-input"
          value={activeDeptId}
          onChange={(e) => onChange(e.target.value)}
        >
          {visibleDepts.map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </label>
    </Panel>
  )
}

function bannerStyle(banner: string) {
  if (/saved|accepted|added|approved|recalculated|created|deleted/i.test(banner)) {
    return { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }
  }
  if (/fail|error|required|unauthorized|overload|not ready|reject/i.test(banner)) {
    return { background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }
  }
  return undefined
}

/** HR Course Allocation — Course → Faculty → Section → L/T/P → Hours */
export function HrAssignmentsPage() {
  const isHodWorkspace = useIsMonitorWorkspace()
  const {
    cseId,
    activeDeptId,
    visibleDepts,
    unlocked,
    unlockInput,
    setUnlockInput,
    unlockMessage,
    tryUnlock,
    lockAgain,
    setDeptId,
  } = useHrDeptScope()

  const overview = useApiData(
    () =>
      api<any>(
        activeDeptId
          ? `/hr/workload/overview?departmentId=${encodeURIComponent(activeDeptId)}`
          : '/hr/workload/overview',
      ),
    [activeDeptId],
  )
  const allocations = useApiData(
    () =>
      api<any[]>(
        activeDeptId
          ? `/hr/allocations?departmentId=${encodeURIComponent(activeDeptId)}`
          : '/hr/allocations',
      ),
    [activeDeptId],
  )

  const [assign, setAssign] = useState({
    facultyId: '',
    courseId: '',
    hours: '3',
    section: '',
    classType: 'L',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [allocPage, setAllocPage] = useState(1)

  const [allocCourseQ, setAllocCourseQ] = useState('')
  const [allocFacultyQ, setAllocFacultyQ] = useState('')
  const [allocSection, setAllocSection] = useState('ALL')
  const [allocClassType, setAllocClassType] = useState('ALL')

  const [editModal, setEditModal] = useState<{
    id: string
    originalFacultyId: string
    originalHours: number
    facultyId: string
    courseId: string
    hours: string
    section: string
    classType: string
  } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<any | null>(null)

  const faculty = overview.data?.faculty || []
  const courseOptions = overview.data?.courses || []
  const banner = message || unlockMessage

  const selectedCourse = useMemo(
    () => courseOptions.find((c: any) => c.id === assign.courseId) || null,
    [courseOptions, assign.courseId],
  )
  const selectedFaculty = useMemo(
    () => faculty.find((f: any) => f.facultyId === assign.facultyId) || null,
    [faculty, assign.facultyId],
  )

  const addHours = Number(assign.hours) || 0
  const formComplete = Boolean(
    assign.courseId &&
      assign.facultyId &&
      assign.section.trim() &&
      ['L', 'T', 'P'].includes(assign.classType) &&
      addHours > 0,
  )
  const previewReady = formComplete

  const preview = useMemo(() => {
    if (!previewReady || !selectedFaculty) return null
    const current = workloadHoursFrom(selectedFaculty)
    const afterAssigned = Math.round((current.assignedHours + addHours) * 10) / 10
    const after = workloadHoursFrom({
      ...selectedFaculty,
      total: afterAssigned,
      assignedHours: afterAssigned,
      status: undefined,
    })
    return { current, after, afterAssigned }
  }, [previewReady, selectedFaculty, addHours])

  const willOverload = preview?.after.status === 'OVERLOAD'

  const recommendations = useMemo(() => {
    if (!previewReady || !willOverload || !selectedFaculty) return []
    const rows = faculty
      .filter((f: any) => f.facultyId !== selectedFaculty.facultyId)
      .map((f: any) => {
        const current = workloadHoursFrom(f)
        const afterAssigned = Math.round((current.assignedHours + addHours) * 10) / 10
        const after = workloadHoursFrom({
          ...f,
          total: afterAssigned,
          assignedHours: afterAssigned,
          status: undefined,
        })
        const distance = Math.abs(after.assignedHours - after.requiredHours)
        const statusRank =
          after.status === 'NORMAL' ? 0 : after.status === 'UNDERLOAD' ? 1 : 2
        return { faculty: f, current, after, afterAssigned, distance, statusRank }
      })
      .filter((r) => r.after.status !== 'OVERLOAD')
      .sort((a, b) => {
        if (a.statusRank !== b.statusRank) return a.statusRank - b.statusRank
        return a.distance - b.distance
      })
    return rows.slice(0, 5)
  }, [previewReady, willOverload, selectedFaculty, faculty, addHours])

  const filteredAllocs = useMemo(() => {
    let rows = allocations.data || []
    const cq = allocCourseQ.trim().toLowerCase()
    const fq = allocFacultyQ.trim().toLowerCase()
    if (cq) {
      rows = rows.filter((a: any) =>
        `${a.course?.code || ''} ${a.course?.name || ''}`.toLowerCase().includes(cq),
      )
    }
    if (fq) {
      rows = rows.filter((a: any) => String(a.faculty?.name || '').toLowerCase().includes(fq))
    }
    if (allocSection !== 'ALL') {
      rows = rows.filter((a: any) =>
        sectionMatchesFilter(a.section || a.course?.section, allocSection),
      )
    }
    if (allocClassType !== 'ALL') {
      rows = rows.filter(
        (a: any) => classTypeLabel(a.classType, a.course?.type) === allocClassType,
      )
    }
    return rows
  }, [allocations.data, allocCourseQ, allocFacultyQ, allocSection, allocClassType])

  const allocPaged = paginate(filteredAllocs, allocPage, 10)

  const editPreview = useMemo(() => {
    if (!editModal) return null
    const f = faculty.find((x: any) => x.facultyId === editModal.facultyId)
    if (!f) return null
    const live = workloadHoursFrom(f)
    const add = Number(editModal.hours) || 0
    let base = live.assignedHours
    if (editModal.facultyId === editModal.originalFacultyId) {
      base = Math.max(0, Math.round((live.assignedHours - editModal.originalHours) * 10) / 10)
    }
    const afterAssigned = Math.round((base + add) * 10) / 10
    const after = workloadHoursFrom({
      ...f,
      total: afterAssigned,
      assignedHours: afterAssigned,
      status: undefined,
    })
    return {
      faculty: f,
      currentHours: base,
      add,
      afterAssigned,
      after,
    }
  }, [editModal, faculty])

  function resetForm() {
    setAssign({ facultyId: '', courseId: '', hours: '3', section: '', classType: 'L' })
  }

  async function persistAllocation(facultyId: string) {
    setMessage(null)
    if (!assign.courseId || !facultyId) {
      setMessage('Select course and faculty before allocating.')
      return
    }
    if (!assign.section.trim()) {
      setMessage('Section is required before allocating.')
      return
    }
    const hours = Number(assign.hours)
    if (!Number.isFinite(hours) || hours <= 0) {
      setMessage('Hours must be a positive number.')
      return
    }
    if (!['L', 'T', 'P'].includes(assign.classType)) {
      setMessage('Select class type: L, T, or P.')
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
          facultyId,
          courseId: assign.courseId,
          hours,
          section: assign.section.trim(),
          classType: assign.classType,
          departmentId,
          confirmOverload: true,
          justification: 'Assigned by HR (Workload Controller)',
        }),
      })
      const after = result?.preCheck?.after
      const statusNote = after?.status
        ? ` — status ${after.status} (${Number(after.total).toFixed(1)}h)`
        : ''
      setMessage(`Course allocated — workload recalculated${statusNote}.`)
      resetForm()
      await Promise.all([overview.reload(), allocations.reload()])
    } catch (err: any) {
      const detail =
        err?.body?.message?.message ||
        err?.body?.message ||
        err?.message ||
        'Allocation failed'
      setMessage(
        typeof detail === 'string'
          ? detail
          : 'Allocation failed — check faculty/course/department.',
      )
    } finally {
      setBusy(false)
    }
  }

  function openEdit(a: any) {
    const ct = classTypeLabel(a.classType, a.course?.type)
    setEditModal({
      id: a.id,
      originalFacultyId: a.facultyId || a.faculty?.id || '',
      originalHours: Number(a.hours) || 0,
      facultyId: a.facultyId || a.faculty?.id || '',
      courseId: a.courseId || a.course?.id || '',
      hours: String(a.hours ?? 3),
      section: String(a.section || a.course?.section || ''),
      classType: ct === '—' ? 'L' : ct,
    })
  }

  async function saveEditChanges() {
    if (!editModal) return
    setMessage(null)
    if (!editModal.courseId || !editModal.facultyId) {
      setMessage('Course and faculty are required.')
      return
    }
    if (!editModal.section.trim()) {
      setMessage('Section is required.')
      return
    }
    const hours = Number(editModal.hours)
    if (!Number.isFinite(hours) || hours <= 0) {
      setMessage('Hours must be a positive number.')
      return
    }
    if (!['L', 'T', 'P'].includes(editModal.classType)) {
      setMessage('Select class type: L, T, or P.')
      return
    }
    const departmentId = activeDeptId || overview.data?.departmentId || cseId
    if (!departmentId) {
      setMessage('Department not ready yet — wait a second and try again.')
      return
    }

    setBusy(true)
    try {
      await api(`/hr/allocations/${editModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          facultyId: editModal.facultyId,
          courseId: editModal.courseId,
          hours,
          section: editModal.section.trim(),
          classType: editModal.classType,
          departmentId,
          confirmOverload: true,
          justification: 'Updated by HR (Workload Controller)',
        }),
      })
      setMessage('Allocation updated — workload recalculated.')
      setEditModal(null)
      await Promise.all([overview.reload(), allocations.reload()])
    } catch (err: any) {
      const detail =
        err?.body?.message?.message ||
        err?.body?.message ||
        err?.message ||
        'Update failed'
      setMessage(typeof detail === 'string' ? detail : 'Update failed.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmRemoveAllocation() {
    if (!removeTarget) return
    const wasLastOnPage = allocPaged.rows.length === 1
    setBusy(true)
    setMessage(null)
    try {
      const q = activeDeptId ? `?departmentId=${encodeURIComponent(activeDeptId)}` : ''
      await apiDelete(`/hr/allocations/${removeTarget.id}${q}`)
      setMessage('Allocation removed — workload recalculated.')
      setRemoveTarget(null)
      await Promise.all([overview.reload(), allocations.reload()])
      if (wasLastOnPage && allocPage > 1) setAllocPage((p) => p - 1)
    } catch (err: any) {
      setMessage(err?.message || 'Remove failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={
          isHodWorkspace
            ? unlocked
              ? 'Unlocked — view course allocations across departments.'
              : 'CSE-only course allocations (view)'
            : unlocked
              ? 'Unlocked — allocate courses to faculty in any department.'
              : 'CSE-only course allocation'
        }
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
      />
      {banner && (
        <div className="alert-banner" style={bannerStyle(banner)}>
          {banner}
        </div>
      )}
      <ErrorRetry error={overview.error} onRetry={() => void overview.reload()} />
      <DeptSelectPanel
        unlocked={unlocked}
        activeDeptId={activeDeptId}
        visibleDepts={visibleDepts}
        onChange={(id) => {
          setDeptId(id)
          resetForm()
        }}
      />

      {!isHodWorkspace && (
      <Panel title="Course Allocation">
        <div className="form-grid alloc-form-grid">
          <label className="field-label">
            <span>Course *</span>
            <select
              className="dash-input"
              required
              value={assign.courseId}
              onChange={(e) => {
                const id = e.target.value
                const course = courseOptions.find((c: any) => c.id === id)
                setAssign({
                  ...assign,
                  courseId: id,
                  section: course?.section ? String(course.section) : assign.section,
                  hours: course?.hoursPerWeek ? String(course.hoursPerWeek) : assign.hours,
                })
              }}
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
            <span>Faculty *</span>
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
                  {f.designation ? ` · ${f.designation}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Section *</span>
            <select
              className="dash-input"
              required
              value={assign.section}
              onChange={(e) => setAssign({ ...assign, section: e.target.value })}
            >
              <option value="">Select section</option>
              {SECTION_CHOICES.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Class Type *</span>
            <select
              className="dash-input"
              required
              value={assign.classType}
              onChange={(e) => setAssign({ ...assign, classType: e.target.value })}
            >
              <option value="L">L · Lecture</option>
              <option value="T">T · Tutorial</option>
              <option value="P">P · Practical</option>
            </select>
          </label>
          <label className="field-label">
            <span>Hours *</span>
            <input
              className="dash-input"
              required
              value={assign.hours}
              onChange={(e) => setAssign({ ...assign, hours: e.target.value })}
            />
          </label>
        </div>

        {preview ? (
          <div className="alloc-preview-card">
            <h3>
              {selectedFaculty?.name}
              {selectedFaculty?.designation ? ` · ${selectedFaculty.designation}` : ''}
              {selectedCourse ? ` · ${selectedCourse.code}` : ''}
            </h3>
            <div className="alloc-preview-meta">
              <div>
                Current: <strong>{hoursLabel(preview.current.assignedHours)}</strong>
              </div>
              <div>
                Course: <strong>+{hoursLabel(addHours)}</strong>
              </div>
              <div>
                After: <strong>{hoursLabel(preview.afterAssigned)}</strong>
              </div>
              <div>
                Required: <strong>{hoursLabel(preview.after.requiredHours)}</strong>
              </div>
              {preview.after.status === 'OVERLOAD' ? (
                <div>
                  Excess: <strong>{hoursLabel(preview.after.excessHours)}</strong>
                </div>
              ) : (
                <div>
                  Remaining: <strong>{hoursLabel(preview.after.remainingHours)}</strong>
                </div>
              )}
              <div>
                Status: <StatusPill status={preview.after.status} />
              </div>
            </div>

            {!willOverload ? (
              <div className="form-actions" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !formComplete}
                  onClick={() => void persistAllocation(assign.facultyId)}
                >
                  {busy ? 'Saving…' : 'Allocate Course'}
                </button>
              </div>
            ) : (
              <>
                <div className="alert-banner" style={{ marginTop: '0.75rem', ...bannerStyle('overload') }}>
                  This allocation will cause overload.
                </div>
                <div className="alloc-recommend-block">
                  <h4>Recommended Faculty</h4>
                  {recommendations.length === 0 ? (
                    <p className="empty-state">No non-overload alternatives found for these hours.</p>
                  ) : (
                    <table className="data-table compact-table">
                      <thead>
                        <tr>
                          <th>Faculty</th>
                          <th>Designation</th>
                          <th>Current</th>
                          <th>Course</th>
                          <th>After</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recommendations.map((row) => (
                          <tr key={row.faculty.facultyId}>
                            <td>
                              <strong>{row.faculty.name}</strong>
                            </td>
                            <td>{row.faculty.designation || row.faculty.cadre || '?'}</td>
                            <td>{hoursLabel(row.current.assignedHours)}</td>
                            <td>+{hoursLabel(addHours)}</td>
                            <td>
                              <strong>{hoursLabel(row.afterAssigned)}</strong>
                            </td>
                            <td>
                              <StatusPill status={row.after.status} />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={busy || !formComplete}
                                onClick={() => void persistAllocation(row.faculty.facultyId)}
                              >
                                Allocate
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="empty-state" style={{ marginTop: '0.75rem' }}>
            Fill Course, Faculty, Section, Class Type, and Hours to allocate.
          </p>
        )}
      </Panel>
      )}

      <Panel
        title="Current allocations"
        action={<span className="meta-chip">{filteredAllocs.length}</span>}
      >
        <div className="form-grid" style={{ marginBottom: '0.65rem' }}>
          <label className="field-label">
            <span>Search Course</span>
            <input
              className="dash-input"
              value={allocCourseQ}
              onChange={(e) => {
                setAllocCourseQ(e.target.value)
                setAllocPage(1)
              }}
              placeholder="Code or name"
            />
          </label>
          <label className="field-label">
            <span>Search Faculty</span>
            <input
              className="dash-input"
              value={allocFacultyQ}
              onChange={(e) => {
                setAllocFacultyQ(e.target.value)
                setAllocPage(1)
              }}
              placeholder="Faculty name"
            />
          </label>
          <label className="field-label">
            <span>Section</span>
            <select
              className="dash-input"
              value={allocSection}
              onChange={(e) => {
                setAllocSection(e.target.value)
                setAllocPage(1)
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
          <label className="field-label">
            <span>Class Type</span>
            <select
              className="dash-input"
              value={allocClassType}
              onChange={(e) => {
                setAllocClassType(e.target.value)
                setAllocPage(1)
              }}
            >
              <option value="ALL">All</option>
              <option value="L">L</option>
              <option value="T">T</option>
              <option value="P">P</option>
            </select>
          </label>
        </div>
        {allocations.loading && <TableSkeleton />}
        <ErrorRetry error={allocations.error} onRetry={() => void allocations.reload()} />
        <table className="data-table">
          <thead>
            <tr>
              <th>Course</th>
              <th>Faculty</th>
              <th>Section</th>
              <th>Class Type</th>
              <th>Hours</th>
              {!isHodWorkspace && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {allocPaged.rows.map((a: any) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.course?.code}</strong>
                  {a.course?.name ? (
                    <>
                      <br />
                      <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{a.course.name}</span>
                    </>
                  ) : null}
                </td>
                <td>{a.faculty?.name || '?'}</td>
                <td>{formatSectionDisplay(a.section || a.course?.section)}</td>
                <td>
                  <ClassTypeBadge type={classTypeLabel(a.classType, a.course?.type)} />
                </td>
                <td>{hoursLabel(Number(a.hours) || 0)}</td>
                {!isHodWorkspace && (
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => openEdit(a)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => setRemoveTarget(a)}
                    >
                      Remove
                    </button>
                  </div>
                </td>
                )}
              </tr>
            ))}
            {!allocations.loading && allocPaged.rows.length === 0 && (
              <tr>
                <td colSpan={isHodWorkspace ? 5 : 6} className="empty-state">
                  No allocations for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager
          page={allocPaged.page}
          pages={allocPaged.pages}
          total={allocPaged.total}
          onPage={setAllocPage}
        />
      </Panel>

      {!isHodWorkspace && editModal ? (
        <div className="profile-modal-backdrop" role="dialog" aria-modal="true">
          <div className="profile-modal alloc-confirm-modal">
            <h3>Edit Allocation</h3>
            <div className="form-grid" style={{ marginTop: '0.55rem' }}>
              <label className="field-label">
                <span>Course</span>
                <select
                  className="dash-input"
                  value={editModal.courseId}
                  onChange={(e) => setEditModal({ ...editModal, courseId: e.target.value })}
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
                <span>Faculty</span>
                <select
                  className="dash-input"
                  value={editModal.facultyId}
                  onChange={(e) => setEditModal({ ...editModal, facultyId: e.target.value })}
                >
                  <option value="">Select faculty</option>
                  {faculty.map((f: any) => (
                    <option key={f.facultyId} value={f.facultyId}>
                      {f.name}
                      {f.designation ? ` · ${f.designation}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                <span>Section</span>
                <select
                  className="dash-input"
                  value={editModal.section}
                  onChange={(e) => setEditModal({ ...editModal, section: e.target.value })}
                >
                  <option value="">Select section</option>
                  {SECTION_CHOICES.map((s) => (
                    <option key={s} value={s}>
                      Section {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                <span>Class Type</span>
                <select
                  className="dash-input"
                  value={editModal.classType}
                  onChange={(e) => setEditModal({ ...editModal, classType: e.target.value })}
                >
                  <option value="L">L · Lecture</option>
                  <option value="T">T · Tutorial</option>
                  <option value="P">P · Practical</option>
                </select>
              </label>
              <label className="field-label">
                <span>Hours</span>
                <input
                  className="dash-input"
                  value={editModal.hours}
                  onChange={(e) => setEditModal({ ...editModal, hours: e.target.value })}
                />
              </label>
            </div>

            {editPreview ? (
              <div className="alloc-preview-meta" style={{ marginTop: '0.75rem' }}>
                <div>
                  Current Hours: <strong>{hoursLabel(editPreview.currentHours)}</strong>
                </div>
                <div>
                  Course Hours: <strong>+{hoursLabel(editPreview.add)}</strong>
                </div>
                <div>
                  After Edit: <strong>{hoursLabel(editPreview.afterAssigned)}</strong>
                </div>
                <div>
                  Required Hours: <strong>{hoursLabel(editPreview.after.requiredHours)}</strong>
                </div>
                {editPreview.after.status === 'OVERLOAD' ? (
                  <div>
                    Excess: <strong>{hoursLabel(editPreview.after.excessHours)}</strong>
                  </div>
                ) : null}
                <div>
                  Final Status: <StatusPill status={editPreview.after.status} />
                </div>
              </div>
            ) : null}

            {editPreview?.after.status === 'OVERLOAD' ? (
              <div className="alert-banner" style={{ marginTop: '0.65rem', ...bannerStyle('overload') }}>
                This edit will cause overload.
              </div>
            ) : null}

            <div className="profile-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setEditModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  busy ||
                  !editModal.courseId ||
                  !editModal.facultyId ||
                  !editModal.section.trim() ||
                  !(Number(editModal.hours) > 0)
                }
                onClick={() => void saveEditChanges()}
              >
                {busy ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isHodWorkspace && removeTarget ? (
        <div className="profile-modal-backdrop" role="dialog" aria-modal="true">
          <div className="profile-modal alloc-confirm-modal">
            <h3>Remove Allocation</h3>
            <div className="alloc-preview-meta" style={{ marginTop: '0.55rem' }}>
              <div>
                Course: <strong>{removeTarget.course?.code || '?'}</strong>
                {removeTarget.course?.name ? ` · ${removeTarget.course.name}` : ''}
              </div>
              <div>
                Faculty: <strong>{removeTarget.faculty?.name || '?'}</strong>
              </div>
              <div>
                Section:{' '}
                <strong>
                  {removeTarget.section || removeTarget.course?.section || '?'}
                </strong>
              </div>
              <div>
                Class Type:{' '}
                <ClassTypeBadge type={classTypeLabel(removeTarget.classType, removeTarget.course?.type)} />
              </div>
              <div>
                Hours: <strong>{hoursLabel(Number(removeTarget.hours) || 0)}</strong>
              </div>
            </div>
            <p style={{ marginTop: '0.75rem', color: '#475569', fontSize: '0.9rem' }}>
              Are you sure you want to remove this allocation?
            </p>
            <div className="profile-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void confirmRemoveAllocation()}
              >
                {busy ? 'Removing…' : 'Remove Allocation'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

/** HR manages timetable slots */
export function HrTimetablePage() {
  const {
    cseId,
    activeDeptId,
    visibleDepts,
    unlocked,
    unlockInput,
    setUnlockInput,
    unlockMessage,
    tryUnlock,
    lockAgain,
    setDeptId,
  } = useHrDeptScope()

  const overview = useApiData(
    () =>
      api<any>(
        activeDeptId
          ? `/hr/workload/overview?departmentId=${encodeURIComponent(activeDeptId)}`
          : '/hr/workload/overview',
      ),
    [activeDeptId],
  )
  const courses = useApiData(
    () =>
      api<any[]>(
        activeDeptId
          ? `/hr/courses?departmentId=${encodeURIComponent(activeDeptId)}`
          : '/hr/courses',
      ),
    [activeDeptId],
  )
  const timetable = useApiData(
    () =>
      api<any[]>(
        activeDeptId
          ? `/hr/timetable?departmentId=${encodeURIComponent(activeDeptId)}`
          : '/hr/timetable',
      ),
    [activeDeptId],
  )

  const [form, setForm] = useState({
    courseId: '',
    facultyId: '',
    dayOfWeek: '1',
    startTime: '09:00',
    endTime: '10:00',
    room: '',
    contactType: 'THEORY',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [slotPage, setSlotPage] = useState(1)
  const [dayFilter, setDayFilter] = useState('ALL')
  const [facultyFilter, setFacultyFilter] = useState('ALL')
  const banner = message || unlockMessage
  const faculty = overview.data?.faculty || []
  const displaySlots = useMemo(
    () => [...SAMPLE_TIMETABLE_SLOTS, ...(timetable.data || [])],
    [timetable.data],
  )
  const facultyFilterOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const s of SAMPLE_TIMETABLE_SLOTS) {
      byId.set(s.facultyId, s.faculty.name)
    }
    for (const f of faculty) {
      const id = String(f.facultyId || '')
      if (id) byId.set(id, f.name || id)
    }
    return [...byId.entries()].map(([id, name]) => ({ facultyId: id, name }))
  }, [faculty])

  const filteredSlots = useMemo(() => {
    return displaySlots.filter((t: any) => {
      if (dayFilter !== 'ALL' && String(t.dayOfWeek) !== dayFilter) return false
      if (facultyFilter !== 'ALL' && String(t.facultyId || t.faculty?.id || '') !== facultyFilter)
        return false
      return true
    })
  }, [displaySlots, dayFilter, facultyFilter])
  const slotPaged = paginate(filteredSlots, slotPage, 10)

  const gridDays = [1, 2, 3, 4, 5, 6]
  const timeBands = useMemo(() => {
    const set = new Set<string>()
    for (const t of filteredSlots) set.add(String(t.startTime || '09:00'))
    const sorted = [...set].sort()
    return sorted.length ? sorted : ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00']
  }, [filteredSlots])

  async function addSlot(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setBusy(true)
    try {
      await api('/hr/timetable', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          dayOfWeek: Number(form.dayOfWeek),
          departmentId: activeDeptId,
        }),
      })
      setMessage('Timetable slot added.')
      setForm((f) => ({ ...f, courseId: '', facultyId: '', room: '' }))
      await timetable.reload()
    } catch (err: any) {
      setMessage(err.message || 'Could not add slot.')
    } finally {
      setBusy(false)
    }
  }

  async function removeSlot(id: string) {
    if (String(id).startsWith('sample-') || String(id).startsWith('demo-')) {
      return
    }
    if (!activeDeptId) return
    setBusy(true)
    setMessage(null)
    try {
      await apiDelete(`/hr/timetable/${id}?departmentId=${encodeURIComponent(activeDeptId)}`)
      setMessage('Slot deleted.')
      await timetable.reload()
    } catch (err: any) {
      setMessage(err.message || 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle={
          unlocked
            ? 'Week grid and slot list for any department.'
            : 'CSE timetable — week grid with faculty and course clarity.'
        }
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
      />
      {banner && (
        <div className="alert-banner" style={bannerStyle(banner)}>
          {banner}
        </div>
      )}
      <DeptSelectPanel
        unlocked={unlocked}
        activeDeptId={activeDeptId}
        visibleDepts={visibleDepts}
        onChange={(id) => {
          setDeptId(id)
          setForm((f) => ({ ...f, courseId: '', facultyId: '' }))
        }}
      />

      <Panel title="Add slot">
        <form className="form-grid" onSubmit={(e) => void addSlot(e)}>
          <label className="field-label">
            <span>Course</span>
            <select
              className="dash-input"
              required
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
            >
              <option value="">Select course</option>
              {(courses.data || []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Faculty</span>
            <select
              className="dash-input"
              required
              value={form.facultyId}
              onChange={(e) => setForm({ ...form, facultyId: e.target.value })}
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
            <span>Day</span>
            <select
              className="dash-input"
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Start</span>
            <input
              className="dash-input"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              required
            />
          </label>
          <label className="field-label">
            <span>End</span>
            <input
              className="dash-input"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              required
            />
          </label>
          <label className="field-label">
            <span>Room</span>
            <input
              className="dash-input"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
            />
          </label>
          <label className="field-label">
            <span>Contact type</span>
            <select
              className="dash-input"
              value={form.contactType}
              onChange={(e) => setForm({ ...form, contactType: e.target.value })}
            >
              <option value="THEORY">Theory</option>
              <option value="TUTORIAL">Tutorial</option>
              <option value="LABORATORY">Laboratory</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Add slot'}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Week grid" action={<span className="meta-chip">{filteredSlots.length} slots</span>}>
        <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
          <label className="field-label">
            <span>Day</span>
            <select
              className="dash-input"
              value={dayFilter}
              onChange={(e) => {
                setDayFilter(e.target.value)
                setSlotPage(1)
              }}
            >
              <option value="ALL">All days</option>
              {DAYS.map((d, i) => (
                <option key={d} value={String(i)}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Faculty</span>
            <select
              className="dash-input"
              value={facultyFilter}
              onChange={(e) => {
                setFacultyFilter(e.target.value)
                setSlotPage(1)
              }}
            >
              <option value="ALL">All faculties</option>
              {facultyFilterOptions.map((f) => (
                <option key={f.facultyId} value={f.facultyId}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="timetable-grid-wrap">
          <table className="timetable-grid">
            <thead>
              <tr>
                <th>Period</th>
                {gridDays.map((d) => (
                  <th key={d}>{DAYS[d]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeBands.map((start) => (
                <tr key={start}>
                  <th>{start}</th>
                  {gridDays.map((d) => {
                    const cells = filteredSlots.filter(
                      (t: any) => Number(t.dayOfWeek) === d && String(t.startTime) === start,
                    )
                    return (
                      <td key={`${d}-${start}`}>
                        {cells.length === 0 ? (
                          <span className="tt-empty">?</span>
                        ) : (
                          cells.map((t: any) => (
                            <div key={t.id} className="tt-cell">
                              <strong>{t.course?.code || '?'}</strong>
                              <span>{t.faculty?.name || '?'}</span>
                              <span>{t.room || t.batchLabel || t.course?.section || '?'}</span>
                            </div>
                          ))
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Slot list">
        {timetable.loading && <TableSkeleton />}
        <ErrorRetry error={timetable.error} onRetry={() => void timetable.reload()} />
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Time</th>
              <th>Course</th>
              <th>Faculty</th>
              <th>Room</th>
              <th>Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {slotPaged.rows.map((t: any) => (
              <tr key={t.id}>
                <td>{DAYS[t.dayOfWeek] || t.dayOfWeek}</td>
                <td>
                  {t.startTime}?{t.endTime}
                </td>
                <td>{t.course?.code || '?'}</td>
                <td>{t.faculty?.name || '?'}</td>
                <td>{t.room || '?'}</td>
                <td>{t.contactType || t.course?.type || '?'}</td>
                <td>
                  {t.isSample || t.isDemo ? null : (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={busy}
                      onClick={() => void removeSlot(t.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!timetable.loading && slotPaged.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  No timetable slots for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager
          page={slotPaged.page}
          pages={slotPaged.pages}
          total={slotPaged.total}
          onPage={setSlotPage}
        />
      </Panel>
    </>
  )
}

/** Monitor / balance view - no assign actions */
export function HrFacultyWorkloadPage() {
  const {
    cseId,
    activeDeptId,
    visibleDepts,
    unlocked,
    unlockInput,
    setUnlockInput,
    unlockMessage,
    tryUnlock,
    lockAgain,
    setDeptId,
  } = useHrDeptScope()

  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const overview = useApiData(
    () =>
      api<any>(
        activeDeptId
          ? `/hr/workload/overview?departmentId=${encodeURIComponent(activeDeptId)}`
          : '/hr/workload/overview',
      ),
    [activeDeptId],
  )

  const faculty = overview.data?.faculty || []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return faculty.filter((f: any) => {
      if (statusFilter && f.status !== statusFilter) return false
      if (!q) return true
      return `${f.name || ''} ${f.facultyCode || ''} ${f.designation || ''}`.toLowerCase().includes(q)
    })
  }, [faculty, statusFilter, query])
  const paged = paginate(filtered, page, 10)
  const stats = overview.data?.stats || {
    total: faculty.length,
    normal: faculty.filter((f: any) => f.status === 'NORMAL').length,
    underload: faculty.filter((f: any) => f.status === 'UNDERLOAD').length,
    overload: faculty.filter((f: any) => f.status === 'OVERLOAD').length,
  }

  return (
    <>
      <PageHeader
        title="Faculty Workload"
        subtitle={
          unlocked ? 'Monitor load balance across departments.' : 'CSE faculty workload monitor.'
        }
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
      />
      {unlockMessage && <div className="alert-banner">{unlockMessage}</div>}
      <ErrorRetry error={overview.error} onRetry={() => void overview.reload()} />

      <div className="stat-grid">
        <Stat label="Total Faculty" value={stats.total ?? '?'} />
        <Stat label="Normal" value={stats.normal ?? '?'} />
        <Stat label="Underload" value={stats.underload ?? '?'} />
        <Stat label="Overload" value={stats.overload ?? '?'} />
      </div>

      <Panel title="Faculty load" action={<span className="meta-chip">{filtered.length}</span>}>
        <div className="form-grid" style={{ marginBottom: '0.75rem' }}>
          <label className="field-label">
            <span>Department</span>
            <select
              className="dash-input"
              value={activeDeptId}
              disabled={!unlocked}
              onChange={(e) => {
                setDeptId(e.target.value)
                setPage(1)
              }}
            >
              {visibleDepts.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Workload status</span>
            <select
              className="dash-input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              <option value="UNDERLOAD">Underload</option>
              <option value="NORMAL">Normal</option>
              <option value="OVERLOAD">Overload</option>
            </select>
          </label>
          <label className="field-label">
            <span>Search</span>
            <input
              className="dash-input"
              placeholder="Faculty name or code"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
            />
          </label>
        </div>
        {overview.loading && <TableSkeleton />}
        <table className="data-table">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Designation</th>
              <th>Assigned</th>
              <th>Required</th>
              <th>Difference</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((f: any) => {
              const h = workloadHoursFrom(f)
              return (
                <tr key={f.facultyId}>
                  <td>
                    <div className="person-cell">
                      <PersonAvatar name={f.name} email={f.email} photoUrl={f.photoUrl} />
                      <div className="person-meta">
                        <strong>{f.name}</strong>
                        <span>{f.facultyCode || ''}</span>
                      </div>
                    </div>
                  </td>
                  <td>{f.designation || f.cadre || '?'}</td>
                  <td>{hoursLabel(h.assignedHours)}</td>
                  <td>{hoursLabel(h.requiredHours)}</td>
                  <td>{h.differenceLabel}</td>
                  <td>
                    <StatusPill status={h.status} />
                  </td>
                </tr>
              )
            })}
            {!overview.loading && paged.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">
                  No faculty match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </Panel>
    </>
  )
}

/** HR course catalogue management */
export function HrCoursesPage() {
  const isHodWorkspace = useIsMonitorWorkspace()
  const {
    cseId,
    activeDeptId,
    visibleDepts,
    unlocked,
    unlockInput,
    setUnlockInput,
    unlockMessage,
    tryUnlock,
    lockAgain,
    setDeptId,
  } = useHrDeptScope()

  const courses = useApiData(
    () =>
      api<any[]>(
        activeDeptId
          ? `/hr/courses?departmentId=${encodeURIComponent(activeDeptId)}`
          : '/hr/courses',
      ),
    [activeDeptId],
  )

  const [form, setForm] = useState({
    code: '',
    name: '',
    hoursPerWeek: '3',
    type: 'THEORY',
    credits: '3',
    semester: '1',
    section: 'A',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importPreview, setImportPreview] = useState<{
    total: number
    ready: number
    invalid: number
    duplicate: number
    rows: any[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [coursePage, setCoursePage] = useState(1)
  const [yearFilter, setYearFilter] = useState('ALL')
  const [semFilter, setSemFilter] = useState('ALL')
  const [sectionFilter, setSectionFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const banner = message || unlockMessage

  function courseYear(c: any) {
    const ay = String(c.academicYear || '')
    if (ay === '1' || ay === '2' || ay === '3' || ay === '4') return Number(ay)
    if (String(c.section || '') === '7') return 4
    const sem = Number(c.semester || 0)
    if (sem === 1 || sem === 2) return 1
    if (sem === 3 || sem === 4) return 2
    if (sem === 5 || sem === 6) return 3
    if (sem === 7 || sem === 8) return 4
    return 0
  }

  const allCourses = courses.data || []
  const yearOptions = useMemo(
    () =>
      Array.from(new Set(allCourses.map((c: any) => courseYear(c)).filter((y: number) => y > 0))).sort(
        (a: number, b: number) => a - b,
      ),
    [allCourses],
  )
  const semOptions = useMemo(() => {
    if (isHodWorkspace) return [1, 2, 3, 4, 5, 6, 7]
    return Array.from(
      new Set(
        allCourses
          .map((c: any) => Number(c.semester || 0))
          .filter((s: number) => s > 0),
      ),
    ).sort((a: number, b: number) => a - b)
  }, [allCourses, isHodWorkspace])
  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allCourses.filter((c: any) => {
      if (yearFilter !== 'ALL' && String(courseYear(c)) !== yearFilter) return false
      if (semFilter !== 'ALL' && String(c.semester || '') !== semFilter) return false
      if (sectionFilter !== 'ALL' && !sectionMatchesFilter(c.section, sectionFilter)) return false
      if (!q) return true
      return `${c.code || ''} ${c.name || ''} ${c.section || ''} ${c.type || ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [allCourses, yearFilter, semFilter, sectionFilter, search])

  const coursePaged = paginate(filteredCourses, coursePage, 10)

  async function addCourse(e: React.FormEvent) {
    e.preventDefault()
    if (!activeDeptId) {
      setMessage('Department not ready yet.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      await api('/hr/courses', {
        method: 'POST',
        body: JSON.stringify({
          departmentId: activeDeptId,
          code: form.code,
          name: form.name,
          hoursPerWeek: Number(form.hoursPerWeek),
          type: form.type,
          credits: Number(form.credits),
          semester: Number(form.semester),
          section: form.section,
        }),
      })
      setForm({
        code: '',
        name: '',
        hoursPerWeek: '3',
        type: 'THEORY',
        credits: '3',
        semester: '1',
        section: 'A',
      })
      setMessage('Course added.')
      await courses.reload()
    } catch (err: any) {
      setMessage(err.message || 'Could not add course.')
    } finally {
      setBusy(false)
    }
  }

  async function onExcelSelected(file: File | null) {
    if (!file) return
    if (!activeDeptId) {
      setMessage('Department not ready yet.')
      return
    }
    setImportBusy(true)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const preview = await apiUpload<{
        total: number
        ready: number
        invalid: number
        duplicate: number
        rows: any[]
      }>(
        `/hr/courses/import/preview?departmentId=${encodeURIComponent(activeDeptId)}`,
        fd,
      )
      setImportPreview(preview)
    } catch (err: any) {
      setMessage(err.message || 'Could not read Excel file.')
      setImportPreview(null)
    } finally {
      setImportBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function confirmExcelImport() {
    if (!importPreview || !activeDeptId) return
    const readyRows = importPreview.rows.filter((r) => r.status === 'ready')
    if (!readyRows.length) {
      setMessage('No valid rows to import.')
      return
    }
    setImportBusy(true)
    setMessage(null)
    try {
      const result = await api<{
        ok: boolean
        summary: {
          coursesCreated: number
          allocationsCreated: number
          timetableCreated: number
          failed: number
        }
      }>('/hr/courses/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ departmentId: activeDeptId, rows: readyRows }),
      })
      const s = result.summary
      setMessage(
        `Import complete — ${s.coursesCreated} courses, ${s.allocationsCreated} assignments, ${s.timetableCreated} timetable slots` +
          (s.failed ? ` (${s.failed} failed)` : '') +
          '.',
      )
      setImportPreview(null)
      invalidateApiCache('/hr/')
      await courses.reload()
    } catch (err: any) {
      setMessage(err.message || 'Import failed.')
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle={
          isHodWorkspace
            ? unlocked
              ? 'View course catalogue for any department.'
              : 'CSE-only course catalogue (view). Unlock for other departments.'
            : unlocked
              ? 'Manage course catalogue for any department.'
              : 'CSE-only course catalogue. Unlock for other departments.'
        }
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
      />
      {banner && (
        <div className="alert-banner" style={bannerStyle(banner)}>
          {banner}
        </div>
      )}
      <DeptSelectPanel
        unlocked={unlocked}
        activeDeptId={activeDeptId}
        visibleDepts={visibleDepts}
        onChange={(id) => {
          setDeptId(id)
          setCoursePage(1)
        }}
      />

      {!isHodWorkspace && (
      <Panel title="Add course">
        <form className="form-grid" onSubmit={(e) => void addCourse(e)}>
          <label className="field-label">
            <span>Code</span>
            <input
              className="dash-input"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label className="field-label">
            <span>Name</span>
            <input
              className="dash-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="field-label">
            <span>Hours / week</span>
            <input
              className="dash-input"
              value={form.hoursPerWeek}
              onChange={(e) => setForm({ ...form, hoursPerWeek: e.target.value })}
            />
          </label>
          <label className="field-label">
            <span>Type</span>
            <select
              className="dash-input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="THEORY">Theory</option>
              <option value="TUTORIAL">Tutorial</option>
              <option value="LABORATORY">Laboratory</option>
            </select>
          </label>
          <label className="field-label">
            <span>Credits</span>
            <input
              className="dash-input"
              value={form.credits}
              onChange={(e) => setForm({ ...form, credits: e.target.value })}
            />
          </label>
          <label className="field-label">
            <span>Semester</span>
            <input
              className="dash-input"
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
            />
          </label>
          <label className="field-label">
            <span>Section</span>
            <input
              className="dash-input"
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
            />
          </label>
          <div className="form-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" type="submit" disabled={busy || importBusy}>
              {busy ? 'Saving...' : 'Add Course'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy || importBusy || !activeDeptId}
              onClick={() => fileInputRef.current?.click()}
            >
              {importBusy ? 'Reading...' : 'Import Excel'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => void onExcelSelected(e.target.files?.[0] || null)}
            />
          </div>
        </form>
      </Panel>
      )}

      {importPreview && !isHodWorkspace && (
        <div
          className="profile-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => !importBusy && setImportPreview(null)}
        >
          <div
            className="profile-modal profile-modal-wide"
            style={{ width: 'min(960px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Import preview</h3>
                <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                  {importPreview.ready} ready · {importPreview.invalid} invalid ·{' '}
                  {importPreview.duplicate} duplicate · {importPreview.total} total
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={importBusy}
                onClick={() => setImportPreview(null)}
              >
                Close
              </button>
            </div>
            <div className="table-wrap" style={{ maxHeight: '50vh', overflow: 'auto' }}>
              <table className="data-table compact-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Status</th>
                    <th>Code</th>
                    <th>Course</th>
                    <th>Faculty</th>
                    <th>Year</th>
                    <th>Sem</th>
                    <th>Sec</th>
                    <th>L/T/P</th>
                    <th>Hrs</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.map((r) => {
                    const notes = [...(r.errors || []), ...(r.warnings || [])].join('; ')
                    const bg =
                      r.status === 'invalid'
                        ? 'rgba(220, 38, 38, 0.08)'
                        : r.status === 'duplicate'
                          ? 'rgba(217, 119, 6, 0.08)'
                          : 'rgba(22, 163, 74, 0.06)'
                    return (
                      <tr key={r.rowIndex} style={{ background: bg }}>
                        <td>{r.rowIndex}</td>
                        <td>
                          <span className="meta-chip">{r.status}</span>
                        </td>
                        <td>{r.courseCode || '?'}</td>
                        <td>{r.courseName || '?'}</td>
                        <td>{r.facultyName || '?'}</td>
                        <td>{r.year || '?'}</td>
                        <td>{r.semester ?? '?'}</td>
                        <td>{r.section || '?'}</td>
                        <td>{r.classType || '?'}</td>
                        <td>{r.hours ?? '?'}</td>
                        <td>{r.day || '?'}</td>
                        <td>
                          {r.startTime && r.endTime ? `${r.startTime}-${r.endTime}` : '—'}
                        </td>
                        <td>{r.room || '?'}</td>
                        <td style={{ color: r.errors?.length ? '#b91c1c' : '#64748b', maxWidth: 180 }}>
                          {notes || '?'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="profile-modal-actions" style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={importBusy}
                onClick={() => setImportPreview(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importBusy || importPreview.ready < 1}
                onClick={() => void confirmExcelImport()}
              >
                {importBusy ? 'Importing...' : `Confirm import (${importPreview.ready})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <Panel title="Course list" action={<span className="meta-chip">{filteredCourses.length}</span>}>
        <div className="form-grid report-filter-grid" style={{ marginBottom: '0.85rem' }}>
          <label className="field-label">
            <span>Year</span>
            <select
              className="dash-input"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value)
                setCoursePage(1)
              }}
            >
              <option value="ALL">All years</option>
              {yearOptions.map((y: number) => (
                <option key={y} value={String(y)}>
                  Year {y}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Semester</span>
            <select
              className="dash-input"
              value={semFilter}
              onChange={(e) => {
                setSemFilter(e.target.value)
                setCoursePage(1)
              }}
            >
              <option value="ALL">All semesters</option>
              {semOptions.map((s: number) => (
                <option key={s} value={String(s)}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Department</span>
            <select
              className="dash-input"
              value={activeDeptId}
              disabled={!unlocked}
              onChange={(e) => {
                setDeptId(e.target.value)
                setCoursePage(1)
              }}
            >
              {visibleDepts.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Section</span>
            <select
              className="dash-input"
              value={sectionFilter}
              onChange={(e) => {
                setSectionFilter(e.target.value)
                setCoursePage(1)
              }}
            >
              <option value="ALL">All sections</option>
              {SECTION_CHOICES.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span>Search</span>
            <input
              className="dash-input"
              placeholder="Code or name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCoursePage(1)
              }}
            />
          </label>
        </div>
        {courses.loading && <TableSkeleton />}
        <ErrorRetry error={courses.error} onRetry={() => void courses.reload()} />
        <table className="data-table compact-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Year</th>
              <th>Semester</th>
              <th>Section</th>
              <th>Type</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {coursePaged.rows.map((c: any) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.code}</strong>
                </td>
                <td>{c.name}</td>
                <td>{courseYear(c) ? `Y${courseYear(c)}` : '—'}</td>
                <td>{c.semester ?? '?'}</td>
                <td>{formatSectionDisplay(c.section)}</td>
                <td>{c.type || '?'}</td>
                <td>{c.hoursPerWeek != null ? `${c.hoursPerWeek}h/w` : '—'}</td>
              </tr>
            ))}
            {!courses.loading && coursePaged.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-state">
                  No courses match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager
          page={coursePaged.page}
          pages={coursePaged.pages}
          total={coursePaged.total}
          onPage={setCoursePage}
        />
      </Panel>
    </>
  )
}

/** Leave + reassignment + corrections queue (unified list). */
export function HrRequestsPage() {
  const isHodWorkspace = useIsMonitorWorkspace()
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'LEAVE' | 'REASSIGNMENT' | 'CORRECTION' | 'OTHER'>(
    'ALL',
  )
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [page, setPage] = useState(1)
  const depts = useApiData(() => api<any[]>('/hr/departments'))
  const cseId = (depts.data || []).find((d: any) => d.code === 'CSE')?.id || ''

  const reassignments = useApiData(() => {
    const q = new URLSearchParams()
    if (isHodWorkspace && cseId) q.set('departmentId', cseId)
    const qs = q.toString()
    return api<any[]>(`/hr/reassignments${qs ? `?${qs}` : ''}`)
  }, [isHodWorkspace, cseId])

  const corrections = useApiData(() => api<any[]>('/hr/corrections'))

  function isCseCorrection(c: any) {
    if (!isHodWorkspace || !cseId) return true
    const code =
      c.submittedBy?.department?.code || c.submittedBy?.faculty?.department?.code || ''
    const deptId =
      c.submittedBy?.departmentId ||
      c.submittedBy?.department?.id ||
      c.submittedBy?.faculty?.departmentId ||
      c.submittedBy?.faculty?.department?.id ||
      ''
    if (deptId === cseId || code === 'CSE') return true
    return !deptId && !code
  }

  function correctionType(c: any): 'LEAVE' | 'CORRECTION' | 'OTHER' {
    const cat = String(c.issueCategory || '').toLowerCase()
    if (cat === 'leave') return 'LEAVE'
    if (cat === 'other') return 'OTHER'
    return 'CORRECTION'
  }

  function correctionTypeLabel(c: any) {
    const t = correctionType(c)
    if (t === 'LEAVE') return 'Leave'
    if (t === 'OTHER') return 'Other'
    return `Correction · ${c.issueCategory || 'General'}`
  }

  function mapStatus(raw: string) {
    const s = String(raw || '').toUpperCase()
    if (s === 'PENDING_UTESH' || s === 'PENDING') return 'PENDING'
    if (s === 'ACCEPTED' || s === 'APPROVED') return 'APPROVED'
    if (s === 'REJECTED') return 'REJECTED'
    return s || 'PENDING'
  }

  const unifiedRows = useMemo(() => {
    const rows: Array<{
      key: string
      source: 'reassignment' | 'correction'
      id: string
      facultyName: string
      typeKey: 'LEAVE' | 'REASSIGNMENT' | 'CORRECTION' | 'OTHER'
      typeLabel: string
      description: string
      date: string
      status: string
      decision: string
      raw: any
    }> = []

    for (const r of reassignments.data || []) {
      const status = mapStatus(r.status)
      rows.push({
        key: `rea-${r.id}`,
        source: 'reassignment',
        id: r.id,
        facultyName: r.fromFaculty?.name || '?',
        typeKey: 'REASSIGNMENT',
        typeLabel: 'Reassignment / Work Transfer',
        description: [
          r.reason,
          r.toFaculty?.name ? `→ ${r.toFaculty.name}` : '',
          r.hours != null ? `(${r.hours}h)` : '',
        ]
          .filter(Boolean)
          .join(' '),
        date: r.date ? String(r.date).slice(0, 10) : '—',
        status,
        decision:
          status === 'APPROVED'
            ? `Approved${r.decidedBy?.name ? ` · ${r.decidedBy.name}` : ''}`
            : status === 'REJECTED'
              ? `Rejected${r.rejectionReason ? ` · ${r.rejectionReason}` : ''}`
              : 'Awaiting HR',
        raw: r,
      })
    }

    for (const c of corrections.data || []) {
      if (!isCseCorrection(c)) continue
      const typeKey = correctionType(c)
      const status = mapStatus(c.status)
      rows.push({
        key: `corr-${c.id}`,
        source: 'correction',
        id: c.id,
        facultyName: c.submittedBy?.faculty?.name || c.submittedBy?.name || '?',
        typeKey,
        typeLabel: correctionTypeLabel(c),
        description: c.description || '?',
        date: c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—',
        status,
        decision:
          status === 'PENDING'
            ? 'Awaiting HR'
            : c.resolutionNote ||
              (c.reviewedBy?.name ? `${status} · ${c.reviewedBy.name}` : status),
        raw: c,
      })
    }

    return rows
      .filter((r) => (typeFilter === 'ALL' ? true : r.typeKey === typeFilter))
      .filter((r) => (statusFilter === 'ALL' ? true : r.status === statusFilter))
      .sort((a, b) => {
        const ta = new Date(a.raw?.createdAt || a.raw?.date || 0).getTime()
        const tb = new Date(b.raw?.createdAt || b.raw?.date || 0).getTime()
        return tb - ta
      })
  }, [reassignments.data, corrections.data, typeFilter, statusFilter, isHodWorkspace, cseId])

  const paged = paginate(unifiedRows, page, 10)

  async function accept(id: string) {
    setBusy(true)
    setMessage(null)
    try {
      await api(`/hr/reassignments/${id}/accept`, { method: 'POST', body: '{}' })
      setMessage('Request approved — timetable/workload updated.')
      await reassignments.reload()
    } catch (e: any) {
      setMessage(e.message || 'Approve failed')
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
    setMessage(null)
    try {
      await api(`/hr/reassignments/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      setMessage('Request rejected.')
      setRejectId(null)
      setRejectReason('')
      await reassignments.reload()
    } catch (e: any) {
      setMessage(e.message || 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  async function reviewCorrection(id: string, status: 'APPROVED' | 'REJECTED') {
    setBusy(true)
    setMessage(null)
    try {
      await api(`/hr/corrections/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, note: `Marked ${status} by HR` }),
      })
      setMessage(`Request ${status.toLowerCase()}.`)
      await corrections.reload()
    } catch (e: any) {
      setMessage(e.message || 'Review failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle={
          isHodWorkspace
            ? 'View CSE faculty leave, reassignment, and correction statuses. View only.'
            : 'Review and approve or reject faculty leave, reassignment, and correction requests.'
        }
      />
      {message && (
        <div className="alert-banner" style={bannerStyle(message)}>
          {message}
        </div>
      )}

      <Panel
        title="All requests"
        action={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              className="dash-input"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="ALL">All types</option>
              <option value="LEAVE">Leave</option>
              <option value="REASSIGNMENT">Reassignment</option>
              <option value="CORRECTION">Correction</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              className="dash-input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any)
                setPage(1)
              }}
            >
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All statuses</option>
            </select>
          </div>
        }
      >
        <ErrorRetry
          error={reassignments.error || corrections.error}
          onRetry={() => {
            void reassignments.reload()
            void corrections.reload()
          }}
        />
        {(reassignments.loading || corrections.loading) && <TableSkeleton />}
        {unifiedRows.length === 0 && !reassignments.loading && !corrections.loading && (
          <p className="empty-state">No requests for this filter.</p>
        )}
        <div className="overflow-x-auto">
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Faculty Name</th>
                <th>Request Type</th>
                <th>Description</th>
                <th>Date</th>
                <th>Status</th>
                <th>HR Decision</th>
                {!isHodWorkspace && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.facultyName}</td>
                  <td>{r.typeLabel}</td>
                  <td>{r.description}</td>
                  <td>{r.date}</td>
                  <td>
                    <StatusPill status={r.status} />
                  </td>
                  <td>{r.decision}</td>
                  {!isHodWorkspace && (
                    <td>
                      {r.source === 'reassignment' && r.status === 'PENDING' ? (
                        rejectId === r.id ? (
                          <div className="form-grid form-grid-stacked" style={{ minWidth: '12rem' }}>
                            <input
                              className="dash-input"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Rejection reason"
                            />
                            <div className="form-actions" style={{ gap: '0.35rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setRejectId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={busy}
                                onClick={() => void reject(r.id)}
                              >
                                Confirm
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={busy}
                              onClick={() => setRejectId(r.id)}
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busy}
                              onClick={() => void accept(r.id)}
                            >
                              Approve
                            </button>
                          </div>
                        )
                      ) : r.source === 'correction' && r.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            disabled={busy}
                            onClick={() => void reviewCorrection(r.id, 'APPROVED')}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={busy}
                            onClick={() => void reviewCorrection(r.id, 'REJECTED')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        '?'
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </Panel>
    </>
  )
}

