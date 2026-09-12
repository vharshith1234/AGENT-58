export type ActivityStatus =
  | 'ONGOING'
  | 'REVIEW'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'ACTIVE'
  | 'SUBMITTED'
  | 'UNDER_REVIEW';

export type ActivityCard = {
  id: string;
  title: string;
  role: string;
  status: ActivityStatus;
  duration: string;
  department: string;
  collaborators: string[];
  progress: number;
  level?: string;
  funding?: string | null;
  commitmentPct?: number;
  studentCount?: number;
  dataSource: 'REAL' | 'DEMO';
  workloadBearing: boolean;
};

export type ActivityTrendPoint = {
  label: string;
  value: number;
};

export type ActivityPortfolio = {
  kind: 'projects' | 'research';
  source: 'REAL' | 'DEMO';
  workloadBearingCount: number;
  countedWorkloadHours: number;
  items: ActivityCard[];
  kpis: {
    total: number;
    active: number;
    completed: number;
    avgProgress: number;
  };
  statusDistribution: { label: string; value: number; color: string }[];
  trend: ActivityTrendPoint[];
  notice: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  ONGOING: '#2563eb',
  ACTIVE: '#2563eb',
  REVIEW: '#d97706',
  UNDER_REVIEW: '#d97706',
  SUBMITTED: '#7c3aed',
  COMPLETED: '#166534',
  ON_HOLD: '#64748b',
};

const PROJECT_TEMPLATES = [
  {
    title: 'Intelligent Timetable Analytics for Section Workload',
    role: 'Guide',
    status: 'ONGOING' as const,
    duration: 'Jul 2026 – Apr 2027',
    level: 'UG',
    progress: 64,
    studentCount: 4,
    extra: 'Industry mentor (demo)',
  },
  {
    title: 'Cloud Resource Scheduling for Academic Labs',
    role: 'Co-guide',
    status: 'REVIEW' as const,
    duration: 'Jan 2026 – Nov 2026',
    level: 'PG',
    progress: 78,
    studentCount: 2,
    extra: 'PG scholar cohort (demo)',
  },
  {
    title: 'Student Outcome Dashboard for Outcome-Based Education',
    role: 'Guide',
    status: 'ONGOING' as const,
    duration: 'Aug 2026 – Mar 2027',
    level: 'UG',
    progress: 41,
    studentCount: 5,
    extra: 'Department project cell (demo)',
  },
  {
    title: 'Secure Attendance and Assessment Portal',
    role: 'Mentor',
    status: 'COMPLETED' as const,
    duration: 'Jul 2025 – Apr 2026',
    level: 'UG',
    progress: 100,
    studentCount: 4,
    extra: 'Alumni reviewer (demo)',
  },
];

const RESEARCH_TEMPLATES = [
  {
    title: 'Explainable Machine Learning for Faculty Workload Balancing',
    role: 'Principal Investigator',
    status: 'ACTIVE' as const,
    duration: 'Jun 2026 – May 2028',
    progress: 38,
    commitmentPct: 20,
    funding: 'Seed grant (demo)',
    extra: 'Co-investigator (demo)',
  },
  {
    title: 'Curriculum Analytics for Computing Programmes',
    role: 'Co-Investigator',
    status: 'UNDER_REVIEW' as const,
    duration: 'Feb 2026 – Jan 2027',
    progress: 55,
    commitmentPct: 12,
    funding: 'Proposal under review (demo)',
    extra: 'School research cluster (demo)',
  },
  {
    title: 'Industry Consultancy: Academic Skill Mapping Study',
    role: 'Consultant',
    status: 'SUBMITTED' as const,
    duration: 'Sep 2025 – Aug 2026',
    progress: 82,
    commitmentPct: 8,
    funding: 'Consultancy (demo)',
    extra: 'Industry partner (demo)',
  },
  {
    title: 'Publication Pipeline: Teaching-Load Patterns in SOCI',
    role: 'Corresponding author',
    status: 'COMPLETED' as const,
    duration: 'Jan 2025 – Dec 2025',
    progress: 100,
    commitmentPct: 5,
    funding: 'Unfunded (demo)',
    extra: 'Doctoral scholar (demo)',
  },
];

function hashSeed(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function rotate<T>(items: T[], offset: number) {
  const n = items.length;
  const start = n ? offset % n : 0;
  return items.slice(start).concat(items.slice(0, start));
}

function activeStatuses() {
  return new Set(['ONGOING', 'ACTIVE', 'REVIEW', 'UNDER_REVIEW', 'SUBMITTED']);
}

export function isWorkloadBearingRecord(row: Record<string, unknown>) {
  if (row.workloadBearing === false) return false;
  if (String(row.dataSource || 'REAL').toUpperCase() === 'DEMO') return false;
  return true;
}

export function analyticsFromItems(
  kind: 'projects' | 'research',
  items: ActivityCard[],
  countedWorkloadHours: number,
  source: 'REAL' | 'DEMO',
): ActivityPortfolio {
  const active = items.filter((item) => activeStatuses().has(item.status)).length;
  const completed = items.filter((item) => item.status === 'COMPLETED').length;
  const avgProgress = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length)
    : 0;
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.status, (counts.get(item.status) || 0) + 1);
  }
  const statusDistribution = [...counts.entries()].map(([label, value]) => ({
    label: label.replaceAll('_', ' '),
    value,
    color: STATUS_COLOR[label] || '#64748b',
  }));
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
  const seed = hashSeed(items.map((i) => i.id).join('|') || kind);
  const trend = months.map((label, i) => ({
    label,
    value: items.length ? 1 + ((seed >> (i * 3)) % 4) : 0,
  }));
  return {
    kind,
    source,
    workloadBearingCount: items.filter((i) => i.workloadBearing).length,
    countedWorkloadHours,
    items,
    kpis: {
      total: items.length,
      active,
      completed,
      avgProgress,
    },
    statusDistribution,
    trend,
    notice: null,
  };
}

export function demoProjectCards(faculty: {
  id: string;
  name: string;
  departmentName: string;
}): ActivityCard[] {
  const offset = hashSeed(faculty.id) % PROJECT_TEMPLATES.length;
  return rotate(PROJECT_TEMPLATES, offset)
    .slice(0, 4)
    .map((row, index) => ({
      id: `demo-project-${faculty.id}-${index}`,
      title: row.title,
      role: row.role,
      status: row.status,
      duration: row.duration,
      department: faculty.departmentName,
      collaborators: [faculty.name, row.extra],
      progress: row.progress,
      level: row.level,
      studentCount: row.studentCount,
      dataSource: 'DEMO' as const,
      workloadBearing: false,
    }));
}

export function demoResearchCards(faculty: {
  id: string;
  name: string;
  departmentName: string;
}): ActivityCard[] {
  const offset = hashSeed(faculty.id + ':research') % RESEARCH_TEMPLATES.length;
  return rotate(RESEARCH_TEMPLATES, offset)
    .slice(0, 4)
    .map((row, index) => ({
      id: `demo-research-${faculty.id}-${index}`,
      title: row.title,
      role: row.role,
      status: row.status,
      duration: row.duration,
      department: faculty.departmentName,
      collaborators: [faculty.name, row.extra],
      progress: row.progress,
      commitmentPct: row.commitmentPct,
      funding: row.funding,
      dataSource: 'DEMO' as const,
      workloadBearing: false,
    }));
}

function formatDuration(start?: Date | null, end?: Date | null, fallback?: string | null) {
  if (start && end) {
    const fmt = (d: Date) =>
      d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }
  if (fallback) return fallback;
  if (start) {
    return `From ${start.toLocaleString('en-IN', { month: 'short', year: 'numeric' })}`;
  }
  return 'Duration not recorded';
}

function progressFromStatus(status: string, fallback: number) {
  const s = status.toUpperCase();
  if (s === 'COMPLETED' || s === 'COMPLETE') return 100;
  if (s === 'ON_HOLD' || s === 'HOLD') return Math.min(fallback, 35);
  if (s === 'REVIEW' || s === 'UNDER_REVIEW' || s === 'SUBMITTED') return Math.max(fallback, 70);
  return fallback;
}

export function mapRealProjects(
  facultyId: string,
  departmentName: string,
  rows: Array<{
    id: string;
    title: string;
    level: string;
    status: string;
    studentCount: number;
    semester: number;
    academicYear: string | null;
    guideId: string;
    guide?: { name: string } | null;
    coGuide?: { name: string } | null;
  }>,
): ActivityCard[] {
  return rows.map((row) => {
    const role = row.guideId === facultyId ? 'Guide' : 'Co-guide';
    const collaborators = [row.guide?.name, row.coGuide?.name].filter(Boolean) as string[];
    const status = (row.status || 'ONGOING').toUpperCase().replace(/\s+/g, '_') as ActivityStatus;
    return {
      id: row.id,
      title: row.title,
      role,
      status: ['ONGOING', 'REVIEW', 'COMPLETED', 'ON_HOLD', 'ACTIVE'].includes(status)
        ? status
        : 'ONGOING',
      duration: formatDuration(null, null, row.academicYear || `Semester ${row.semester}`),
      department: departmentName,
      collaborators,
      progress: progressFromStatus(row.status, 48),
      level: row.level,
      studentCount: row.studentCount,
      dataSource: 'REAL',
      workloadBearing: true,
    };
  });
}

export function mapRealResearch(
  departmentName: string,
  facultyName: string,
  rows: Array<{
    id: string;
    projectTitle: string;
    role: string;
    status: string;
    commitmentPct: number;
    fundingStatus: string | null;
    startDate: Date | null;
    endDate: Date | null;
  }>,
): ActivityCard[] {
  return rows.map((row) => {
    const status = (row.status || 'ACTIVE').toUpperCase().replace(/\s+/g, '_') as ActivityStatus;
    return {
      id: row.id,
      title: row.projectTitle,
      role: row.role,
      status: ['ACTIVE', 'SUBMITTED', 'UNDER_REVIEW', 'COMPLETED', 'ONGOING'].includes(status)
        ? status
        : 'ACTIVE',
      duration: formatDuration(row.startDate, row.endDate),
      department: departmentName,
      collaborators: [facultyName],
      progress: progressFromStatus(row.status, Math.round(row.commitmentPct || 30)),
      commitmentPct: row.commitmentPct,
      funding: row.fundingStatus,
      dataSource: 'REAL',
      workloadBearing: true,
    };
  });
}
