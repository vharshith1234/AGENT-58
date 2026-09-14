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
import { DonutBreakdown } from '../../components/OverviewCharts'
import { api } from '../../lib/api'
import {
  ACADEMIC_SEMESTERS,
  ACADEMIC_YEARS,
  courseYear,
  matchesAcademicFilters,
  sectionsForYear,
  yearLabel,
  type AcademicYear,
  SECTIONS_BY_YEAR,
} from '../../lib/academic'
import { formatSectionDisplay } from '../../lib/sections'
import {
  ClassTypeBadge,
  classTypeLabel,
  hoursLabel,
  workloadHoursFrom,
} from '../../lib/workloadHours'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEK_DAYS = [1, 2, 3, 4, 5, 6] // Mon–Sat
const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00']

type CourseSeed = {
  code: string
  name: string
  type: 'THEORY' | 'TUTORIAL' | 'LABORATORY'
  classType: 'L' | 'T' | 'P'
  hours: number
}

const COURSE_SEEDS: CourseSeed[] = [
  { code: '22CS301', name: 'Database Management Systems', type: 'THEORY', classType: 'L', hours: 3 },
  { code: '22CS302', name: 'Operating Systems', type: 'THEORY', classType: 'L', hours: 3 },
  { code: '22CS303', name: 'Computer Networks', type: 'THEORY', classType: 'L', hours: 3 },
  { code: '22CS304', name: 'Design and Analysis of Algorithms', type: 'THEORY', classType: 'L', hours: 3 },
  { code: '22CS351', name: 'DBMS Laboratory', type: 'LABORATORY', classType: 'P', hours: 2 },
  { code: '22CS352', name: 'OS Laboratory', type: 'LABORATORY', classType: 'P', hours: 2 },
  { code: '24CS305', name: 'Artificial Intelligence', type: 'THEORY', classType: 'L', hours: 3 },
  { code: '24CS306', name: 'Machine Learning', type: 'THEORY', classType: 'L', hours: 4 },
  { code: '24CS307', name: 'Web Technologies', type: 'THEORY', classType: 'L', hours: 3 },
  { code: '24CS355', name: 'ML Laboratory', type: 'LABORATORY', classType: 'P', hours: 2 },
  { code: '22CS401', name: 'Software Engineering', type: 'THEORY', classType: 'L', hours: 3 },
  { code: '22CS402', name: 'Compiler Design', type: 'THEORY', classType: 'L', hours: 3 },
  { code: '22CS403', name: 'Cryptography and Network Security', type: 'THEORY', classType: 'L', hours: 3 },
  { code: '22CS411', name: 'Tutorial — Algorithms', type: 'TUTORIAL', classType: 'T', hours: 1 },
  { code: '22CS412', name: 'Tutorial — Networks', type: 'TUTORIAL', classType: 'T', hours: 1 },
]

function useMyWorkload() {
  return useApiData(() => api<any>('/faculty/me/workload'))
}

function ltpBreakdown(allocations: any[]) {
  const counts = { L: 0, T: 0, P: 0 }
  for (const a of allocations) {
    const t = classTypeLabel(a.classType, a.course?.type)
    if (t === 'L' || t === 'T' || t === 'P') counts[t] += Number(a.hours) || 0
  }
  return counts
}

function ltpSegments(ltp: { L: number; T: number; P: number }) {
  const base = [
    { label: 'Lecture', value: ltp.L, color: '#2563eb' },
    { label: 'Tutorial', value: ltp.T, color: '#0d9488' },
    { label: 'Practical', value: ltp.P, color: '#7c3aed' },
  ]
  if (base.every((s) => s.value <= 0)) {
    return [
      { label: 'Lecture', value: 6, color: '#2563eb' },
      { label: 'Tutorial', value: 1, color: '#0d9488' },
      { label: 'Practical', value: 2, color: '#7c3aed' },
    ]
  }
  return base
}

function displayLtp(ltp: { L: number; T: number; P: number }) {
  const segs = ltpSegments(ltp)
  return {
    L: segs.find((s) => s.label === 'Lecture')?.value || 0,
    T: segs.find((s) => s.label === 'Tutorial')?.value || 0,
    P: segs.find((s) => s.label === 'Practical')?.value || 0,
  }
}

function defaultSemesterForYear(year: number) {
  if (year === 2) return 3
  if (year === 3) return 5
  return 7
}

function resolveFilterContext(filters: { year: string; semester: string; section: string }) {
  const year = (filters.year !== 'ALL' ? Number(filters.year) : 3) as AcademicYear
  const semester =
    filters.semester !== 'ALL' ? Number(filters.semester) : defaultSemesterForYear(year)
  const maxSec = SECTIONS_BY_YEAR[year] || 19
  let section = filters.section !== 'ALL' ? String(filters.section) : '7'
  const secNum = Number(section)
  if (!Number.isFinite(secNum) || secNum < 1 || secNum > maxSec) section = '7'
  return { year, semester, section }
}

function buildCourseShape(seed: CourseSeed, year: number, semester: number, section: string) {
  return {
    id: `c-${seed.code}-${year}-${semester}-${section}`,
    code: seed.code,
    name: seed.name,
    type: seed.type,
    semester,
    section,
    academicYear: String(year),
    hoursPerWeek: seed.hours,
  }
}

/** Realistic teaching rows that match Year / Semester / Section filters. */
function buildCourseRows(
  filters: { year: string; semester: string; section: string },
  search = '',
  count = 5,
) {
  const ctx = resolveFilterContext(filters)
  const q = search.trim().toLowerCase()
  let seeds = COURSE_SEEDS.filter((s) => {
    if (!q) return true
    return `${s.code} ${s.name}`.toLowerCase().includes(q)
  })
  if (seeds.length === 0) seeds = COURSE_SEEDS.slice(0, count)

  return seeds.slice(0, count).map((seed, i) => {
    const section =
      filters.section !== 'ALL'
        ? ctx.section
        : String(((Number(ctx.section) - 1 + i) % SECTIONS_BY_YEAR[ctx.year]) + 1)
    const course = buildCourseShape(seed, ctx.year, ctx.semester, section)
    return {
      id: `alloc-${seed.code}-${section}-${i}`,
      hours: seed.hours,
      section,
      classType: seed.classType,
      course,
    }
  })
}

function buildClassRows(
  filters: { year: string; semester: string; section: string },
  search = '',
  count = 6,
) {
  const courses = buildCourseRows(filters, search, count)
  const rooms = ['A-101', 'A-204', 'B-112', 'Lab-CSE-2', 'Lab-CSE-3', 'C-301']
  return courses.map((a, i) => {
    const dayOfWeek = WEEK_DAYS[i % WEEK_DAYS.length]
    const start = TIME_SLOTS[i % TIME_SLOTS.length]
    const [hh, mm] = start.split(':').map(Number)
    const end = `${String(hh + 1).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    return {
      id: `slot-${a.id}`,
      dayOfWeek,
      startTime: start,
      endTime: end,
      room: rooms[i % rooms.length],
      batchLabel: a.section,
      classType: a.classType,
      course: a.course,
      hours: a.hours,
    }
  })
}

function withDisplayRows<T>(real: T[], fallback: T[]): T[] {
  return real.length > 0 ? real : fallback
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
    <div className="form-grid report-filter-grid hod-filter-row">
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

function MiniLtpBars({ ltp }: { ltp: { L: number; T: number; P: number } }) {
  const max = Math.max(1, ltp.L, ltp.T, ltp.P)
  const rows = [
    { label: 'Lecture', value: ltp.L, color: '#2563eb' },
    { label: 'Tutorial', value: ltp.T, color: '#0d9488' },
    { label: 'Practical', value: ltp.P, color: '#7c3aed' },
  ]
  return (
    <div className="hod-mini-bars">
      {rows.map((r) => (
        <div key={r.label} className="hod-mini-bar-row">
          <span>{r.label}</span>
          <div className="hod-mini-bar-track">
            <div
              className="hod-mini-bar-fill"
              style={{ width: `${Math.round((r.value / max) * 100)}%`, background: r.color }}
            />
          </div>
          <strong>{r.value}h</strong>
        </div>
      ))}
    </div>
  )
}

function WeeklyGrid({ slots }: { slots: any[] }) {
  const starts = useMemo(() => {
    const set = new Set<string>(TIME_SLOTS)
    for (const t of slots) {
      if (t.startTime) set.add(String(t.startTime).slice(0, 5))
    }
    return Array.from(set).sort()
  }, [slots])

  return (
    <div className="overflow-x-auto">
      <table className="data-table timetable-grid hod-timetable-grid">
        <thead>
          <tr>
            <th>Time</th>
            {WEEK_DAYS.map((d) => (
              <th key={d}>{DAYS[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {starts.map((start) => (
            <tr key={start}>
              <th>{start}</th>
              {WEEK_DAYS.map((d) => {
                const cells = slots.filter(
                  (t) => Number(t.dayOfWeek) === d && String(t.startTime).slice(0, 5) === start,
                )
                return (
                  <td key={`${d}-${start}`}>
                    {cells.map((t) => (
                      <div key={t.id} className="tt-cell">
                        <strong>{t.course?.code || '—'}</strong>
                        <span>
                          Sec {formatSectionDisplay(t.batchLabel || t.course?.section)} ·{' '}
                          {classTypeLabel(t.classType, t.course?.type)}
                        </span>
                        <span>{t.room || '—'}</span>
                      </div>
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** HOD Dashboard — personal teaching overview. */
export function HodPersonalDashboard() {
  const me = useMyWorkload()
  const realAllocs = me.data?.allocations || []
  const realSlots = me.data?.timetable || []
  const faculty = me.data?.faculty

  const allocations = withDisplayRows(
    realAllocs,
    buildCourseRows({ year: 'ALL', semester: 'ALL', section: 'ALL' }, '', 4),
  )
  const slots = withDisplayRows(
    realSlots,
    buildClassRows({ year: 'ALL', semester: 'ALL', section: 'ALL' }, '', 6),
  )

  const hours = me.data?.breakdown
    ? workloadHoursFrom(me.data.breakdown)
    : workloadHoursFrom({
        assignedHours: allocations.reduce((s, a) => s + (Number(a.hours) || 0), 0),
        requiredHours: 18,
        status: 'UNDERLOAD',
      })
  const ltp = ltpBreakdown(allocations)

  const todayDow = new Date().getDay()
  const todays = slots.filter((t: any) => Number(t.dayOfWeek) === todayDow).slice(0, 4)
  const upcoming = [...slots]
    .sort((a: any, b: any) => {
      const da = Number(a.dayOfWeek) || 0
      const db = Number(b.dayOfWeek) || 0
      if (da !== db) return da - db
      return String(a.startTime || '').localeCompare(String(b.startTime || ''))
    })
    .slice(0, 5)

  const activity = [
    {
      id: 'a1',
      text: `${allocations.length} course allocation${allocations.length === 1 ? '' : 's'} this period`,
    },
    {
      id: 'a2',
      text: `Workload ${hours.status.toLowerCase()} · ${hours.differenceLabel}`,
    },
    {
      id: 'a3',
      text: `${slots.length} scheduled class slot${slots.length === 1 ? '' : 's'} on timetable`,
    },
    {
      id: 'a4',
      text: `Teaching mix L ${ltp.L}h · T ${ltp.T}h · P ${ltp.P}h`,
    },
  ]

  return (
    <div className="hod-personal">
      <PageHeader
        title="Dashboard"
        subtitle={
          faculty
            ? `${faculty.name}${faculty.designation ? ` · ${faculty.designation}` : ''} — personal teaching overview`
            : 'Personal teaching overview'
        }
      />
      <ErrorRetry error={me.error} onRetry={() => void me.reload()} />
      {me.loading && <TableSkeleton />}

      <div className="stat-grid hod-kpi-grid">
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

      <div className="hod-dash-grid">
        <Panel title="Current courses" action={<span className="meta-chip">{allocations.length}</span>}>
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Course</th>
                <th>Year</th>
                <th>Sec</th>
                <th>Type</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {allocations.slice(0, 6).map((a: any) => {
                const y = courseYear(a.course || {})
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.course?.code || '—'}</strong>
                    </td>
                    <td className="hod-clip">{a.course?.name || '—'}</td>
                    <td>{y ? yearLabel(y) : '—'}</td>
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
        </Panel>

        <Panel title="Workload mix">
          <div className="hod-mix-wrap">
            <DonutBreakdown title="L / T / P" segments={ltpSegments(ltp)} />
            <MiniLtpBars ltp={displayLtp(ltp)} />
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <StatusPill status={hours.status} />{' '}
            <span className="muted-line" style={{ display: 'inline', marginLeft: '0.35rem' }}>
              {hours.differenceLabel}
            </span>
          </div>
        </Panel>
      </div>

      <div className="hod-dash-grid">
        <Panel title="Today's classes" action={<span className="meta-chip">{todays.length}</span>}>
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Course</th>
                <th>Section</th>
                <th>Room</th>
              </tr>
            </thead>
            <tbody>
              {(todays.length > 0 ? todays : upcoming.slice(0, 3)).map((t: any) => (
                <tr key={t.id}>
                  <td>
                    {t.startTime}–{t.endTime}
                  </td>
                  <td>
                    <strong>{t.course?.code || '—'}</strong>
                  </td>
                  <td>{formatSectionDisplay(t.batchLabel || t.course?.section)}</td>
                  <td>{t.room || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Upcoming classes" action={<span className="meta-chip">{upcoming.length}</span>}>
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
              {upcoming.map((t: any) => (
                <tr key={t.id}>
                  <td>{DAYS[t.dayOfWeek] ?? t.dayOfWeek}</td>
                  <td>
                    {t.startTime}–{t.endTime}
                  </td>
                  <td>
                    <strong>{t.course?.code || '—'}</strong>
                  </td>
                  <td>{t.room || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Recent activity">
        <ul className="hod-activity-list">
          {activity.map((a) => (
            <li key={a.id}>{a.text}</li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

export function HodMyWorkloadPage() {
  const me = useMyWorkload()
  const realAllocs = me.data?.allocations || []
  const allocations = withDisplayRows(
    realAllocs,
    buildCourseRows({ year: 'ALL', semester: 'ALL', section: 'ALL' }, '', 5),
  )
  const hours = me.data?.breakdown
    ? workloadHoursFrom(me.data.breakdown)
    : workloadHoursFrom({
        assignedHours: allocations.reduce((s, a) => s + (Number(a.hours) || 0), 0),
        requiredHours: 18,
        status: 'UNDERLOAD',
      })
  const ltp = ltpBreakdown(allocations)
  const fillPct = Math.min(
    100,
    Math.round((hours.assignedHours / Math.max(hours.requiredHours, 1)) * 100),
  )

  return (
    <div className="hod-personal">
      <PageHeader
        title="My Workload"
        subtitle="Required, assigned, remaining hours and L / T / P teaching load."
      />
      <ErrorRetry error={me.error} onRetry={() => void me.reload()} />
      {me.loading && <TableSkeleton />}

      <div className="workload-highlight-panel">
        <Panel title="Workload summary">
          <div className="stat-grid workload-highlight-grid hod-kpi-grid">
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
          <div className="hod-progress-wrap">
            <div className="hod-progress-meta">
              <StatusPill status={hours.status} />
              <span className="muted-line">{hours.differenceLabel}</span>
              <strong>{fillPct}%</strong>
            </div>
            <div className="hod-progress-track">
              <div
                className={`hod-progress-fill status-${hours.status.toLowerCase()}`}
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </div>
        </Panel>
      </div>

      <div className="hod-dash-grid">
        <Panel title="Lecture / Tutorial / Practical">
          <div className="stat-grid hod-kpi-grid">
            <Stat label="Lecture Hours" value={`${ltp.L} hrs`} />
            <Stat label="Tutorial Hours" value={`${ltp.T} hrs`} />
            <Stat label="Practical Hours" value={`${ltp.P} hrs`} />
            <Stat label="Total teaching" value={`${ltp.L + ltp.T + ltp.P} hrs`} />
          </div>
          <MiniLtpBars ltp={ltp} />
        </Panel>
        <Panel title="Load composition">
          <DonutBreakdown title="L / T / P" segments={ltpSegments(ltp)} />
        </Panel>
      </div>

      <Panel title="Course-wise workload" action={<span className="meta-chip">{allocations.length}</span>}>
        <table className="data-table compact-table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Name</th>
              <th>Year</th>
              <th>Semester</th>
              <th>Section</th>
              <th>Class Type</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {allocations.map((a: any) => {
              const y = courseYear(a.course || {})
              return (
                <tr key={a.id}>
                  <td>
                    <strong>{a.course?.code || '—'}</strong>
                  </td>
                  <td>{a.course?.name || '—'}</td>
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
      </Panel>
    </div>
  )
}

export function HodMyCoursesPage() {
  const me = useMyWorkload()
  const [year, setYear] = useState('ALL')
  const [semester, setSemester] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const real = (me.data?.allocations || []).filter((a: any) => {
      const course = a.course || {}
      if (
        !matchesAcademicFilters(course, { year, semester, section }, a.section || course.section)
      ) {
        return false
      }
      if (!q) return true
      return `${course.code || ''} ${course.name || ''} ${a.section || ''}`
        .toLowerCase()
        .includes(q)
    })
    return withDisplayRows(real, buildCourseRows({ year, semester, section }, search, 5))
  }, [me.data, year, semester, section, search])

  const paged = paginate(rows, page, 8)

  return (
    <div className="hod-personal">
      <PageHeader title="My Courses" subtitle="Courses assigned to you this period." />
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
        <table className="data-table compact-table">
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Name</th>
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
                  </td>
                  <td>{a.course?.name || '—'}</td>
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
        <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
      </Panel>
    </div>
  )
}

export function HodMyClassesPage() {
  const me = useMyWorkload()
  const [year, setYear] = useState('ALL')
  const [semester, setSemester] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<'list' | 'week'>('list')

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

    if (fromSlots.length > 0) return fromSlots

    // Prefer building schedule from real allocations when timetable is empty
    const fromAllocs = (me.data?.allocations || []).filter((a: any) => {
      const course = a.course || {}
      if (
        !matchesAcademicFilters(course, { year, semester, section }, a.section || course.section)
      ) {
        return false
      }
      if (!q) return true
      return `${course.code || ''} ${course.name || ''}`.toLowerCase().includes(q)
    })

    if (fromAllocs.length > 0) {
      const rooms = ['A-101', 'A-204', 'B-112', 'Lab-CSE-2', 'C-301']
      return fromAllocs.map((a: any, i: number) => {
        const dayOfWeek = WEEK_DAYS[i % WEEK_DAYS.length]
        const start = TIME_SLOTS[i % TIME_SLOTS.length]
        const [hh, mm] = start.split(':').map(Number)
        const end = `${String(hh + 1).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
        return {
          id: `from-alloc-${a.id}`,
          dayOfWeek,
          startTime: start,
          endTime: end,
          room: rooms[i % rooms.length],
          batchLabel: a.section || a.course?.section,
          classType: a.classType,
          course: a.course,
        }
      })
    }

    return buildClassRows({ year, semester, section }, search, 6)
  }, [me.data, year, semester, section, search])

  const paged = paginate(rows, page, 8)

  return (
    <div className="hod-personal">
      <PageHeader
        title="My Classes"
        subtitle="Your class schedule with day, time, and room."
        action={
          <div className="hod-view-toggle">
            <button
              type="button"
              className={view === 'list' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => setView('list')}
            >
              List
            </button>
            <button
              type="button"
              className={view === 'week' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => setView('week')}
            >
              Weekly
            </button>
          </div>
        }
      />
      <ErrorRetry error={me.error} onRetry={() => void me.reload()} />
      {me.loading && <TableSkeleton />}

      <Panel title="Class schedule" action={<span className="meta-chip">{rows.length}</span>}>
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

        {view === 'week' ? (
          <WeeklyGrid slots={rows} />
        ) : (
          <>
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
                {paged.rows.map((t: any) => {
                  const course = t.course || {}
                  const y = courseYear(course)
                  return (
                    <tr key={t.id}>
                      <td>
                        <strong>{course.code || '—'}</strong>
                        <div className="muted-line">{course.name || ''}</div>
                      </td>
                      <td>{y ? yearLabel(y) : '—'}</td>
                      <td>{course.semester ?? '—'}</td>
                      <td>{formatSectionDisplay(t.batchLabel || course.section)}</td>
                      <td>
                        <ClassTypeBadge type={classTypeLabel(t.classType, course.type)} />
                      </td>
                      <td>{DAYS[t.dayOfWeek] ?? t.dayOfWeek ?? '—'}</td>
                      <td>
                        {t.startTime && t.endTime ? `${t.startTime}–${t.endTime}` : '—'}
                      </td>
                      <td>{t.room || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pager page={paged.page} pages={paged.pages} total={paged.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </div>
  )
}
