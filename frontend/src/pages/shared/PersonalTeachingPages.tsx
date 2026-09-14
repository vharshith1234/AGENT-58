import { useMemo, useState } from 'react'
import {
  ErrorRetry,
  PageHeader,
  Panel,
  Stat,
  TableSkeleton,
  paginate,
  Pager,
  useApiData,
} from '../../components/DashboardShell'
import { StatusPill } from '../../components/PersonAvatar'
import { api } from '../../lib/api'
import {
  ACADEMIC_SEMESTERS,
  ACADEMIC_YEARS,
  courseYear,
  matchesAcademicFilters,
  sectionsForYear,
  yearLabel,
} from '../../lib/academic'
import { formatSectionDisplay } from '../../lib/sections'
import {
  ClassTypeBadge,
  classTypeLabel,
  hoursLabel,
  workloadHoursFrom,
} from '../../lib/workloadHours'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function useMyWorkload() {
  return useApiData(() => api<any>('/faculty/me/workload'))
}

function AcademicFilterRow({
  year,
  semester,
  section,
  search,
  onYear,
  onSemester,
  onSection,
  onSearch,
  showSearch = true,
}: {
  year: string
  semester: string
  section: string
  search?: string
  onYear: (v: string) => void
  onSemester: (v: string) => void
  onSection: (v: string) => void
  onSearch?: (v: string) => void
  showSearch?: boolean
}) {
  const sectionOptions = sectionsForYear(year)
  return (
    <div className="form-grid report-filter-grid" style={{ marginBottom: '0.85rem' }}>
      <label className="field-label">
        <span>Year</span>
        <select
          className="dash-input"
          value={year}
          onChange={(e) => {
            onYear(e.target.value)
            onSection('ALL')
          }}
        >
          <option value="ALL">All years</option>
          {ACADEMIC_YEARS.map((y) => (
            <option key={y} value={String(y)}>
              {yearLabel(y)}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        <span>Semester</span>
        <select className="dash-input" value={semester} onChange={(e) => onSemester(e.target.value)}>
          <option value="ALL">All semesters</option>
          {ACADEMIC_SEMESTERS.map((s) => (
            <option key={s} value={String(s)}>
              Semester {s}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        <span>Section</span>
        <select className="dash-input" value={section} onChange={(e) => onSection(e.target.value)}>
          <option value="ALL">All sections</option>
          {sectionOptions.map((s) => (
            <option key={s} value={s}>
              Section {s}
            </option>
          ))}
        </select>
      </label>
      {showSearch && onSearch ? (
        <label className="field-label">
          <span>Search</span>
          <input
            className="dash-input"
            placeholder="Code or name"
            value={search || ''}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
      ) : null}
    </div>
  )
}

function ltpBreakdown(allocations: any[]) {
  const counts = { L: 0, T: 0, P: 0 }
  for (const a of allocations) {
    const t = classTypeLabel(a.classType, a.course?.type)
    if (t === 'L' || t === 'T' || t === 'P') counts[t] += Number(a.hours) || 0
  }
  return counts
}

/** Personal teaching dashboard (Faculty + HOD). */
export function PersonalTeachingDashboard({
  title = 'Dashboard',
  subtitle = 'Your teaching workload, courses, and timetable.',
}: {
  title?: string
  subtitle?: string
}) {
  const me = useMyWorkload()
  const allocations = me.data?.allocations || []
  const slots = me.data?.timetable || []
  const faculty = me.data?.faculty
  const hours = me.data?.breakdown ? workloadHoursFrom(me.data.breakdown) : null
  const ltp = ltpBreakdown(allocations)

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          faculty
            ? `${faculty.name}${faculty.facultyCode ? ` · ${faculty.facultyCode}` : ''} — ${subtitle}`
            : subtitle
        }
      />
      <ErrorRetry error={me.error} onRetry={() => void me.reload()} />
      {me.loading && <TableSkeleton />}
      {hours ? (
        <div className="stat-grid">
          <Stat label="Required Hours" value={hoursLabel(hours.requiredHours)} />
          <Stat label="Assigned Hours" value={hoursLabel(hours.assignedHours)} />
          <Stat
            label={hours.status === 'OVERLOAD' ? 'Excess Hours' : 'Remaining Hours'}
            value={
              hours.status === 'OVERLOAD'
                ? hoursLabel(hours.excessHours)
                : hoursLabel(hours.remainingHours)
            }
          />
          <Stat label="Workload Status" value={hours.status} />
        </div>
      ) : null}
      {hours ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <StatusPill status={hours.status} />{' '}
          <span className="muted-line" style={{ display: 'inline', marginLeft: '0.35rem' }}>
            {hours.differenceLabel} · L {ltp.L}h · T {ltp.T}h · P {ltp.P}h
          </span>
        </div>
      ) : null}
      <div className="grid-2">
        <Panel title="My courses" action={<span className="meta-chip">{allocations.length}</span>}>
          {allocations.length === 0 ? (
            <p className="empty-state">No courses allocated yet.</p>
          ) : (
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Year</th>
                  <th>Section</th>
                  <th>Type</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {allocations.slice(0, 6).map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.course?.code || '—'}</strong>
                    </td>
                    <td>{courseYear(a.course || {}) ? `Y${courseYear(a.course || {})}` : '—'}</td>
                    <td>{formatSectionDisplay(a.section || a.course?.section)}</td>
                    <td>
                      <ClassTypeBadge type={classTypeLabel(a.classType, a.course?.type)} />
                    </td>
                    <td className="num-cell">{a.hours ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="Upcoming classes" action={<span className="meta-chip">{slots.length}</span>}>
          {slots.length === 0 ? (
            <p className="empty-state">No timetable slots yet.</p>
          ) : (
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Course</th>
                  <th>Room</th>
                </tr>
              </thead>
              <tbody>
                {slots.slice(0, 6).map((t: any) => (
                  <tr key={t.id}>
                    <td>{DAYS[t.dayOfWeek] ?? t.dayOfWeek}</td>
                    <td>
                      {t.startTime}–{t.endTime}
                    </td>
                    <td>{t.course?.code || '—'}</td>
                    <td>{t.room || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  )
}

export function PersonalMyWorkloadPage() {
  const me = useMyWorkload()
  const allocations = me.data?.allocations || []
  const hours = me.data?.breakdown ? workloadHoursFrom(me.data.breakdown) : null
  const ltp = ltpBreakdown(allocations)

  return (
    <>
      <PageHeader
        title="My Workload"
        subtitle="Required, assigned, and remaining hours with L/T/P teaching breakdown."
      />
      <ErrorRetry error={me.error} onRetry={() => void me.reload()} />
      {me.loading && <TableSkeleton />}
      {hours ? (
        <div className="workload-highlight-panel">
          <Panel title="Current workload">
            <div className="stat-grid workload-highlight-grid">
              <Stat label="Required Hours" value={hoursLabel(hours.requiredHours)} />
              <Stat label="Assigned Hours" value={hoursLabel(hours.assignedHours)} />
              <Stat
                label={hours.status === 'OVERLOAD' ? 'Excess Hours' : 'Remaining Hours'}
                value={
                  hours.status === 'OVERLOAD'
                    ? hoursLabel(hours.excessHours)
                    : hoursLabel(hours.remainingHours)
                }
              />
              <Stat label="Workload Status" value={hours.status} />
            </div>
            <div style={{ marginTop: '0.55rem' }}>
              <StatusPill status={hours.status} />{' '}
              <span className="muted-line" style={{ display: 'inline', marginLeft: '0.35rem' }}>
                {hours.differenceLabel}
              </span>
            </div>
          </Panel>
        </div>
      ) : null}
      <Panel title="Teaching breakdown (L / T / P)">
        <div className="stat-grid">
          <Stat label="Lecture (L)" value={`${ltp.L} hrs`} />
          <Stat label="Tutorial (T)" value={`${ltp.T} hrs`} />
          <Stat label="Practical (P)" value={`${ltp.P} hrs`} />
          <Stat label="Total teaching" value={`${ltp.L + ltp.T + ltp.P} hrs`} />
        </div>
      </Panel>
    </>
  )
}

export function PersonalMyCoursesPage() {
  const me = useMyWorkload()
  const [year, setYear] = useState('ALL')
  const [semester, setSemester] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (me.data?.allocations || []).filter((a: any) => {
      const course = a.course || {}
      if (
        !matchesAcademicFilters(
          course,
          { year, semester, section },
          a.section || course.section,
        )
      ) {
        return false
      }
      if (!q) return true
      return `${course.code || ''} ${course.name || ''} ${a.section || ''}`
        .toLowerCase()
        .includes(q)
    })
  }, [me.data, year, semester, section, search])

  const paged = paginate(rows, page, 10)

  return (
    <>
      <PageHeader title="My Courses" subtitle="Courses assigned to you." />
      <ErrorRetry error={me.error} onRetry={() => void me.reload()} />
      {me.loading && <TableSkeleton />}
      <Panel title="Assigned courses" action={<span className="meta-chip">{rows.length}</span>}>
        <AcademicFilterRow
          year={year}
          semester={semester}
          section={section}
          search={search}
          onYear={(v) => {
            setYear(v)
            setPage(1)
          }}
          onSemester={(v) => {
            setSemester(v)
            setPage(1)
          }}
          onSection={(v) => {
            setSection(v)
            setPage(1)
          }}
          onSearch={(v) => {
            setSearch(v)
            setPage(1)
          }}
        />
        {rows.length === 0 ? (
          <p className="empty-state">No courses match these filters.</p>
        ) : (
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Year</th>
                <th>Semester</th>
                <th>Section</th>
                <th>Class Type</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((a: any) => {
                const y = courseYear(a.course || {})
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.course?.code || '—'}</strong>
                      <div className="muted-line">{a.course?.name || ''}</div>
                    </td>
                    <td>{y ? yearLabel(y) : '—'}</td>
                    <td>{a.course?.semester ?? '—'}</td>
                    <td>{formatSectionDisplay(a.section || a.course?.section)}</td>
                    <td>
                      <ClassTypeBadge type={classTypeLabel(a.classType, a.course?.type)} />
                    </td>
                    <td className="num-cell">{a.hours ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </Panel>
    </>
  )
}

export function PersonalMyClassesPage() {
  const me = useMyWorkload()
  const [year, setYear] = useState('ALL')
  const [semester, setSemester] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const slots = me.data?.timetable || []
    const fromSlots = slots.filter((t: any) => {
      const course = t.course || {}
      if (
        !matchesAcademicFilters(
          course,
          { year, semester, section },
          t.batchLabel || course.section,
        )
      ) {
        return false
      }
      if (!q) return true
      return `${course.code || ''} ${course.name || ''} ${t.room || ''}`
        .toLowerCase()
        .includes(q)
    })
    if (fromSlots.length > 0) return fromSlots.map((t: any) => ({ kind: 'slot' as const, ...t }))

    // Fallback: allocation rows when timetable is empty
    return (me.data?.allocations || [])
      .filter((a: any) => {
        const course = a.course || {}
        if (
          !matchesAcademicFilters(
            course,
            { year, semester, section },
            a.section || course.section,
          )
        ) {
          return false
        }
        if (!q) return true
        return `${course.code || ''} ${course.name || ''}`.toLowerCase().includes(q)
      })
      .map((a: any) => ({ kind: 'alloc' as const, ...a }))
  }, [me.data, year, semester, section, search])

  const paged = paginate(rows, page, 10)

  return (
    <>
      <PageHeader
        title="My Classes"
        subtitle="Classes assigned to you with day, time, and room when scheduled."
      />
      <ErrorRetry error={me.error} onRetry={() => void me.reload()} />
      {me.loading && <TableSkeleton />}
      <Panel title="Current classes" action={<span className="meta-chip">{rows.length}</span>}>
        <AcademicFilterRow
          year={year}
          semester={semester}
          section={section}
          search={search}
          onYear={(v) => {
            setYear(v)
            setPage(1)
          }}
          onSemester={(v) => {
            setSemester(v)
            setPage(1)
          }}
          onSection={(v) => {
            setSection(v)
            setPage(1)
          }}
          onSearch={(v) => {
            setSearch(v)
            setPage(1)
          }}
        />
        {rows.length === 0 ? (
          <p className="empty-state">No classes match these filters.</p>
        ) : (
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Year</th>
                <th>Semester</th>
                <th>Section</th>
                <th>Class Type</th>
                <th>Day</th>
                <th>Time</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((r: any, idx: number) => {
                const course = r.course || {}
                const y = courseYear(course)
                if (r.kind === 'slot') {
                  return (
                    <tr key={r.id || idx}>
                      <td>
                        <strong>{course.code || '—'}</strong>
                        <div className="muted-line">{course.name || ''}</div>
                      </td>
                      <td>{y ? yearLabel(y) : '—'}</td>
                      <td>{course.semester ?? '—'}</td>
                      <td>{formatSectionDisplay(r.batchLabel || course.section)}</td>
                      <td>
                        <ClassTypeBadge type={classTypeLabel(r.classType, course.type)} />
                      </td>
                      <td>{DAYS[r.dayOfWeek] ?? r.dayOfWeek ?? '—'}</td>
                      <td>
                        {r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : '—'}
                      </td>
                      <td>{r.room || '—'}</td>
                    </tr>
                  )
                }
                return (
                  <tr key={r.id || idx}>
                    <td>
                      <strong>{course.code || '—'}</strong>
                      <div className="muted-line">{course.name || ''}</div>
                    </td>
                    <td>{y ? yearLabel(y) : '—'}</td>
                    <td>{course.semester ?? '—'}</td>
                    <td>{formatSectionDisplay(r.section || course.section)}</td>
                    <td>
                      <ClassTypeBadge type={classTypeLabel(r.classType, course.type)} />
                    </td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </Panel>
    </>
  )
}

export function PersonalTimetablePage() {
  const me = useMyWorkload()
  const [year, setYear] = useState('ALL')
  const [semester, setSemester] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    return (me.data?.timetable || []).filter((t: any) =>
      matchesAcademicFilters(
        t.course || {},
        { year, semester, section },
        t.batchLabel || t.course?.section,
      ),
    )
  }, [me.data, year, semester, section])

  const paged = paginate(rows, page, 12)

  return (
    <>
      <PageHeader title="Timetable" subtitle="Your scheduled contact hours." />
      <ErrorRetry error={me.error} onRetry={() => void me.reload()} />
      {me.loading && <TableSkeleton />}
      <Panel title="Weekly timetable" action={<span className="meta-chip">{rows.length}</span>}>
        <AcademicFilterRow
          year={year}
          semester={semester}
          section={section}
          onYear={(v) => {
            setYear(v)
            setPage(1)
          }}
          onSemester={(v) => {
            setSemester(v)
            setPage(1)
          }}
          onSection={(v) => {
            setSection(v)
            setPage(1)
          }}
          showSearch={false}
        />
        {rows.length === 0 ? (
          <p className="empty-state">No timetable slots for these filters.</p>
        ) : (
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Course</th>
                <th>Year</th>
                <th>Semester</th>
                <th>Section</th>
                <th>Class Type</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((t: any) => {
                const y = courseYear(t.course || {})
                return (
                  <tr key={t.id}>
                    <td>{DAYS[t.dayOfWeek] ?? t.dayOfWeek}</td>
                    <td>
                      {t.startTime}–{t.endTime}
                    </td>
                    <td>
                      <strong>{t.course?.code || '—'}</strong>
                      <div className="muted-line">{t.course?.name || ''}</div>
                    </td>
                    <td>{y ? yearLabel(y) : '—'}</td>
                    <td>{t.course?.semester ?? '—'}</td>
                    <td>{formatSectionDisplay(t.batchLabel || t.course?.section)}</td>
                    <td>
                      <ClassTypeBadge type={classTypeLabel(t.classType, t.course?.type)} />
                    </td>
                    <td>{t.room || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </Panel>
    </>
  )
}
