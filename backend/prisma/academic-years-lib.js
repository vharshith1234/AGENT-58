/**
 * DEMO academic catalogues: years 2–4, sections A/B/C, mixed workload targets.
 * Teaching hours come from Course Allocation. Timetable slots are schedule only.
 */

const SECTIONS = ['A', 'B', 'C'];

const DEPT_ACADEMIC = {
  IT: {
    y2: [
      { code: 'IT201', name: 'Data Structures', type: 'THEORY' },
      { code: 'IT202', name: 'Operating Systems', type: 'THEORY' },
      { code: 'IT203', name: 'Object Oriented Programming', type: 'THEORY' },
      { code: 'IT201-P', name: 'Data Structures Laboratory', type: 'LABORATORY' },
    ],
    y3: [
      { code: 'IT301', name: 'Software Engineering', type: 'THEORY' },
      { code: 'IT302', name: 'Computer Networks', type: 'THEORY' },
      { code: 'IT303', name: 'Design and Analysis of Algorithms', type: 'THEORY' },
      { code: 'IT301-P', name: 'Software Engineering Laboratory', type: 'LABORATORY' },
    ],
    y4: [
      { code: 'IT401', name: 'Database Management Systems', type: 'THEORY' },
      { code: 'IT402', name: 'Web Technologies', type: 'THEORY' },
      { code: 'IT403', name: 'Information Security', type: 'THEORY' },
      { code: 'IT402-P', name: 'Web Technologies Laboratory', type: 'LABORATORY' },
    ],
  },
  CA: {
    y2: [
      { code: 'CA201', name: 'Programming in C', type: 'THEORY' },
      { code: 'CA202', name: 'Computer Organization', type: 'THEORY' },
      { code: 'CA203', name: 'Discrete Mathematics', type: 'THEORY' },
      { code: 'CA201-P', name: 'C Programming Laboratory', type: 'LABORATORY' },
    ],
    y3: [
      { code: 'CA301', name: 'Web Programming', type: 'THEORY' },
      { code: 'CA302', name: 'Operating Systems', type: 'THEORY' },
      { code: 'CA303', name: 'Data Mining', type: 'THEORY' },
      { code: 'CA301-P', name: 'Web Programming Laboratory', type: 'LABORATORY' },
    ],
    y4: [
      { code: 'CA401', name: 'Programming in Java', type: 'THEORY' },
      { code: 'CA402', name: 'Database Systems', type: 'THEORY' },
      { code: 'CA403', name: 'Software Engineering', type: 'THEORY' },
      { code: 'CA401-P', name: 'Java Laboratory', type: 'LABORATORY' },
    ],
  },
  ACSE: {
    y2: [
      { code: 'AC201', name: 'Advanced Programming', type: 'THEORY' },
      { code: 'AC202', name: 'Computer Architecture', type: 'THEORY' },
      { code: 'AC203', name: 'Probability and Statistics', type: 'THEORY' },
      { code: 'AC201-P', name: 'Advanced Programming Laboratory', type: 'LABORATORY' },
    ],
    y3: [
      { code: 'AC301', name: 'Machine Learning', type: 'THEORY' },
      { code: 'AC302', name: 'Big Data Platforms', type: 'THEORY' },
      { code: 'AC303', name: 'Cyber Security', type: 'THEORY' },
      { code: 'AC301-P', name: 'Machine Learning Laboratory', type: 'LABORATORY' },
    ],
    y4: [
      { code: 'AC401', name: 'Advanced Algorithms', type: 'THEORY' },
      { code: 'AC402', name: 'Cloud Computing', type: 'THEORY' },
      { code: 'AC403', name: 'Distributed Systems', type: 'THEORY' },
      { code: 'AC402-P', name: 'Cloud Computing Laboratory', type: 'LABORATORY' },
    ],
  },
  ECE: {
    y2: [
      { code: 'EC201', name: 'Electronic Devices', type: 'THEORY' },
      { code: 'EC202', name: 'Network Theory', type: 'THEORY' },
      { code: 'EC203', name: 'Electromagnetic Fields', type: 'THEORY' },
      { code: 'EC201-P', name: 'Electronic Devices Laboratory', type: 'LABORATORY' },
    ],
    y3: [
      { code: 'EC301', name: 'Analog Circuits', type: 'THEORY' },
      { code: 'EC302', name: 'Microprocessors', type: 'THEORY' },
      { code: 'EC303', name: 'Control Systems', type: 'THEORY' },
      { code: 'EC301-P', name: 'Analog Circuits Laboratory', type: 'LABORATORY' },
    ],
    y4: [
      { code: 'EC401', name: 'Digital Electronics', type: 'THEORY' },
      { code: 'EC402', name: 'Signals and Systems', type: 'THEORY' },
      { code: 'EC403', name: 'Communication Systems', type: 'THEORY' },
      { code: 'EC401-P', name: 'Digital Electronics Laboratory', type: 'LABORATORY' },
    ],
  },
  EEE: {
    y2: [
      { code: 'EE201', name: 'Electrical Circuit Analysis', type: 'THEORY' },
      { code: 'EE202', name: 'Electromagnetic Fields', type: 'THEORY' },
      { code: 'EE203', name: 'Electrical Measurements', type: 'THEORY' },
      { code: 'EE201-P', name: 'Circuits Laboratory', type: 'LABORATORY' },
    ],
    y3: [
      { code: 'EE301', name: 'Power Electronics', type: 'THEORY' },
      { code: 'EE302', name: 'Electrical Drives', type: 'THEORY' },
      { code: 'EE303', name: 'Switchgear and Protection', type: 'THEORY' },
      { code: 'EE301-P', name: 'Power Electronics Laboratory', type: 'LABORATORY' },
    ],
    y4: [
      { code: 'EE401', name: 'Electrical Machines', type: 'THEORY' },
      { code: 'EE402', name: 'Power Systems', type: 'THEORY' },
      { code: 'EE403', name: 'Control Systems', type: 'THEORY' },
      { code: 'EE401-P', name: 'Electrical Machines Laboratory', type: 'LABORATORY' },
    ],
  },
  MECH: {
    y2: [
      { code: 'ME201', name: 'Engineering Mechanics', type: 'THEORY' },
      { code: 'ME202', name: 'Material Science', type: 'THEORY' },
      { code: 'ME203', name: 'Fluid Mechanics', type: 'THEORY' },
      { code: 'ME201-P', name: 'Mechanics Laboratory', type: 'LABORATORY' },
    ],
    y3: [
      { code: 'ME301', name: 'Heat Transfer', type: 'THEORY' },
      { code: 'ME302', name: 'Dynamics of Machinery', type: 'THEORY' },
      { code: 'ME303', name: 'CAD/CAM', type: 'THEORY' },
      { code: 'ME301-P', name: 'Heat Transfer Laboratory', type: 'LABORATORY' },
    ],
    y4: [
      { code: 'ME401', name: 'Thermodynamics', type: 'THEORY' },
      { code: 'ME402', name: 'Machine Design', type: 'THEORY' },
      { code: 'ME403', name: 'Manufacturing Processes', type: 'THEORY' },
      { code: 'ME403-P', name: 'Manufacturing Laboratory', type: 'LABORATORY' },
    ],
  },
  CIVIL: {
    y2: [
      { code: 'CE201', name: 'Strength of Materials', type: 'THEORY' },
      { code: 'CE202', name: 'Surveying', type: 'THEORY' },
      { code: 'CE203', name: 'Building Materials', type: 'THEORY' },
      { code: 'CE201-P', name: 'Strength of Materials Laboratory', type: 'LABORATORY' },
    ],
    y3: [
      { code: 'CE301', name: 'Transportation Engineering', type: 'THEORY' },
      { code: 'CE302', name: 'Environmental Engineering', type: 'THEORY' },
      { code: 'CE303', name: 'Concrete Technology', type: 'THEORY' },
      { code: 'CE301-P', name: 'Transportation Laboratory', type: 'LABORATORY' },
    ],
    y4: [
      { code: 'CE401', name: 'Structural Engineering', type: 'THEORY' },
      { code: 'CE402', name: 'Geotechnical Engineering', type: 'THEORY' },
      { code: 'CE403', name: 'Fluid Mechanics', type: 'THEORY' },
      { code: 'CE403-P', name: 'Fluid Mechanics Laboratory', type: 'LABORATORY' },
    ],
  },
  DMS: {
    y2: [
      { code: 'MS201', name: 'Managerial Economics', type: 'THEORY' },
      { code: 'MS202', name: 'Business Statistics', type: 'THEORY' },
      { code: 'MS203', name: 'Financial Accounting', type: 'THEORY' },
      { code: 'MS201-T', name: 'Managerial Economics Tutorial', type: 'TUTORIAL' },
    ],
    y3: [
      { code: 'MS301', name: 'Human Resource Management', type: 'THEORY' },
      { code: 'MS302', name: 'Operations Management', type: 'THEORY' },
      { code: 'MS303', name: 'Business Analytics', type: 'THEORY' },
      { code: 'MS301-T', name: 'HRM Tutorial', type: 'TUTORIAL' },
    ],
    y4: [
      { code: 'MS401', name: 'Principles of Management', type: 'THEORY' },
      { code: 'MS402', name: 'Marketing Management', type: 'THEORY' },
      { code: 'MS403', name: 'Organizational Behavior', type: 'THEORY' },
      { code: 'MS401-T', name: 'Principles of Management Tutorial', type: 'TUTORIAL' },
    ],
  },
  CSE: {
    y2: [
      { code: 'CS201', name: 'Data Structures and Algorithms', type: 'THEORY' },
      { code: 'CS202', name: 'Digital Logic Design', type: 'THEORY' },
      { code: 'CS203', name: 'Object Oriented Programming', type: 'THEORY' },
      { code: 'CS201-P', name: 'Data Structures Laboratory', type: 'LABORATORY' },
    ],
    y3: [
      { code: 'CS301', name: 'Database Management Systems', type: 'THEORY' },
      { code: 'CS302', name: 'Operating Systems', type: 'THEORY' },
      { code: 'CS303', name: 'Computer Networks', type: 'THEORY' },
      { code: 'CS301-P', name: 'Database Laboratory', type: 'LABORATORY' },
    ],
    y4: [
      { code: 'CS401', name: 'Compiler Design', type: 'THEORY' },
      { code: 'CS402', name: 'Software Engineering', type: 'THEORY' },
      { code: 'CS403', name: 'Information Security', type: 'THEORY' },
      { code: 'CS401-P', name: 'Compiler Design Laboratory', type: 'LABORATORY' },
    ],
  },
};

const YEAR_META = {
  y2: { year: 2, semester: 3, academicYear: '2' },
  y3: { year: 3, semester: 5, academicYear: '3' },
  y4: { year: 4, semester: 7, academicYear: '4' },
};

function flattenCatalog(spec) {
  const rows = [];
  for (const key of ['y2', 'y3', 'y4']) {
    const meta = YEAR_META[key];
    for (const course of spec[key] || []) {
      rows.push({ ...course, ...meta });
    }
  }
  return rows;
}

/** Mixed statuses: OVERLOAD >20, NORMAL 16–20, UNDERLOAD <16 (theory weight 1). */
function hourTargets(n) {
  if (n <= 0) return [];
  if (n === 1) return [18];
  if (n === 2) return [22, 10];
  if (n === 3) return [22, 18, 10];
  if (n === 4) return [22, 22, 18, 10];
  if (n === 5) return [22, 22, 18, 18, 10];
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(i % 3 === 0 ? 22 : i % 3 === 1 ? 18 : 10);
  }
  return out;
}

function buildOfferings(catalog) {
  const offerings = [];
  for (const course of catalog) {
    for (const section of SECTIONS) {
      offerings.push({
        code: course.code,
        name: course.name,
        type: course.type,
        year: course.year,
        semester: course.semester,
        academicYear: course.academicYear,
        section,
      });
    }
  }
  return offerings;
}

function assignOfferings(offerings, facultyIds) {
  const targets = hourTargets(facultyIds.length);
  const theory = offerings.filter((o) => o.type === 'THEORY' || o.type === 'TUTORIAL');
  const labs = offerings.filter((o) => o.type === 'LABORATORY');
  const assigned = [];
  let oi = 0;
  for (let i = 0; i < facultyIds.length; i += 1) {
    let need = targets[i];
    while (need > 0 && oi < theory.length) {
      const hours = Math.min(6, need);
      assigned.push({
        ...theory[oi],
        facultyId: facultyIds[i],
        hours,
      });
      need -= hours;
      oi += 1;
    }
  }
  labs.forEach((lab, i) => {
    assigned.push({
      ...lab,
      facultyId: facultyIds[i % facultyIds.length],
      hours: 2,
    });
  });
  return assigned;
}

function nextSlot(cursors, facultyId) {
  const cur = cursors[facultyId] || { day: 1, hour: 8 };
  const start = `${String(cur.hour).padStart(2, '0')}:00`;
  const end = `${String(cur.hour + 1).padStart(2, '0')}:00`;
  const day = cur.day;
  cur.hour += 1;
  if (cur.hour >= 16) {
    cur.hour = 8;
    cur.day = cur.day >= 6 ? 1 : cur.day + 1;
  }
  cursors[facultyId] = cur;
  return { day, start, end };
}

function contactType(courseType) {
  const t = String(courseType || 'THEORY').toUpperCase();
  if (t === 'LABORATORY' || t === 'LAB') return 'LAB';
  if (t === 'TUTORIAL') return 'TUTORIAL';
  return 'THEORY';
}

async function seedDepartmentAcademic(prisma, { dept, facultyIds, catalogSpec, roomPrefix }) {
  const catalog = flattenCatalog(catalogSpec);
  const courseIds = {};
  let courses = 0;
  for (const c of catalog) {
    const existing = await prisma.course.findUnique({
      where: { code_departmentId: { code: c.code, departmentId: dept.id } },
    });
    const data = {
      code: c.code,
      name: c.name,
      semester: c.semester,
      credits: c.type === 'LABORATORY' || c.type === 'TUTORIAL' ? 1.5 : 3,
      type: c.type,
      hoursPerWeek: 3,
      students: 60,
      section: null,
      academicYear: c.academicYear,
      status: 'ACTIVE',
      dataSource: 'DEMO',
      departmentId: dept.id,
    };
    const saved = existing
      ? await prisma.course.update({ where: { id: existing.id }, data })
      : await prisma.course.create({ data });
    courseIds[c.code] = saved.id;
    courses += 1;
  }

  const offerings = assignOfferings(buildOfferings(catalog), facultyIds);
  const cursors = {};
  const hoursByFaculty = {};
  let allocations = 0;
  let timetableEntries = 0;

  for (const off of offerings) {
    const courseId = courseIds[off.code];
    if (!courseId || !off.facultyId) continue;
    await prisma.courseAllocation.create({
      data: {
        courseId,
        facultyId: off.facultyId,
        hours: off.hours,
        section: off.section,
        dataSource: 'DEMO',
      },
    });
    hoursByFaculty[off.facultyId] = (hoursByFaculty[off.facultyId] || 0) + off.hours;
    allocations += 1;

    const slot = nextSlot(cursors, off.facultyId);
    await prisma.timetableSlot.create({
      data: {
        courseId,
        facultyId: off.facultyId,
        dayOfWeek: slot.day,
        startTime: slot.start,
        endTime: slot.end,
        room: `${roomPrefix}-${off.academicYear}${off.section}`,
        contactType: contactType(off.type),
        durationHrs: 1,
        batchLabel: off.section,
        dataSource: 'DEMO',
      },
    });
    timetableEntries += 1;
  }

  return { courses, allocations, timetableEntries, hoursByFaculty };
}

module.exports = {
  SECTIONS,
  DEPT_ACADEMIC,
  flattenCatalog,
  hourTargets,
  seedDepartmentAcademic,
};
