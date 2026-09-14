/**
 * Parse official CSE Odd-2026 workbook into JSON artifacts.
 * Source: prisma/data/cse-odd-2026/Workload-AY-2026-27-I-Sem.xlsx
 *
 * Run: node prisma/parse-cse-odd-2026.js
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { emailFromName, slugFromName } = require('./login-credentials');

const DATA_DIR = path.join(__dirname, 'data', 'cse-odd-2026');
const WORKBOOK = path.join(DATA_DIR, 'Workload-AY-2026-27-I-Sem.xlsx');
const FACULTY_LIST_2 = path.join(DATA_DIR, 'Faculty-List-2.xlsx');

function cell(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.replace(/\s+/g, ' ').trim();
    return t || null;
  }
  return v;
}

function empStr(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // preserve leading zeros for typical 5-digit codes
    const n = Math.trunc(v);
    const s = String(n);
    return s.length < 5 ? s.padStart(5, '0') : s;
  }
  return String(v).trim().replace(/\.0$/, '');
}

function num(v, fallback = 0) {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function yearToSemester(year) {
  const y = String(year || '').toUpperCase().replace(/[^IVX0-9]/g, '');
  const map = { I: 1, II: 2, III: 3, IV: 4, '1': 1, '2': 2, '3': 3, '4': 4 };
  return map[y] || map[String(year)] || 1;
}

function normalizeEmail(email) {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  if (!e.includes('@')) return null;
  return e;
}

function stableCourseCode(raw, title, leadMap) {
  const c = cell(raw);
  if (c && !/^to be assigned$/i.test(c) && !/^new\s*code$/i.test(c) && c.toUpperCase() !== 'NEWCODE') {
    return c.replace(/\s+/g, '');
  }
  // Prefer lead-faculty placeholder mapping by title
  const titleKey = String(title || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (leadMap && leadMap[titleKey]?.code && !/^to be assigned$/i.test(leadMap[titleKey].code)) {
    return leadMap[titleKey].code;
  }
  const slug = slugFromName(title || 'course')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24)
    .toUpperCase();
  return `NEW-${slug || 'COURSE'}`;
}

function loadEmailBackfill() {
  const map = new Map(); // empCode -> email, also nameSlug -> email
  if (!fs.existsSync(FACULTY_LIST_2)) return map;
  const wb = XLSX.readFile(FACULTY_LIST_2);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  for (const r of rows) {
    const emp = empStr(r[1]);
    const name = cell(r[2]);
    const email = normalizeEmail(r[5]);
    if (!email) continue;
    if (emp) map.set(`emp:${emp}`, email);
    if (name) map.set(`name:${slugFromName(name)}`, email);
  }
  return map;
}

function parseLeadFaculty(wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Lead Faculty'], { header: 1, defval: null });
  const byTitle = {};
  const list = [];
  let header = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').toLowerCase() === 'year' && String(rows[i][1] || '').toLowerCase().includes('course')) {
      header = i;
      break;
    }
  }
  for (let i = header + 1; i < rows.length; i++) {
    const year = cell(rows[i][0]);
    const code = cell(rows[i][1]);
    const title = cell(rows[i][2]);
    const lead = cell(rows[i][3]);
    if (!title) continue;
    const titleKey = title
      .toLowerCase()
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const cleanCode =
      code && !/^to be assigned$/i.test(code)
        ? code.replace(/\s+/g, '')
        : `NEW${String(year || 'X').replace(/[^IVX0-9]/g, '') || 'X'}${String(list.length + 1).padStart(3, '0')}`;
    const entry = { year, code: cleanCode, title, leadFacultyName: lead };
    list.push(entry);
    byTitle[titleKey] = entry;
  }
  return { list, byTitle };
}

function parseFL(wb, emailBackfill) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.FL, { header: 1, defval: null });
  let header = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').toLowerCase().includes('sl') && String(rows[i][1] || '').toLowerCase().includes('emp')) {
      header = i;
      break;
    }
  }
  const faculty = [];
  const missingEmails = [];
  const usedEmails = new Set();
  for (let i = header + 1; i < rows.length; i++) {
    const sl = rows[i][0];
    if (typeof sl !== 'number') continue;
    const empCode = empStr(rows[i][1]);
    const name = cell(rows[i][2]);
    if (!empCode || !name) continue;
    let email =
      normalizeEmail(rows[i][5]) ||
      emailBackfill.get(`emp:${empCode}`) ||
      emailBackfill.get(`name:${slugFromName(name)}`) ||
      null;
    if (!email) {
      email = emailFromName(name);
      missingEmails.push({ empCode, name, generatedEmail: email });
    }
    // uniquify
    let finalEmail = email;
    if (usedEmails.has(finalEmail)) {
      const [local, domain] = finalEmail.split('@');
      let n = 2;
      while (usedEmails.has(`${local}${n}@${domain}`)) n += 1;
      finalEmail = `${local}${n}@${domain}`;
    }
    usedEmails.add(finalEmail);
    faculty.push({
      sl,
      empCode,
      name,
      designation: cell(rows[i][3]) || 'Faculty',
      phone: rows[i][4] != null ? String(rows[i][4]).replace(/\.0$/, '') : null,
      email: finalEmail,
      emailFromSheet: Boolean(normalizeEmail(rows[i][5])),
    });
  }
  return { faculty, missingEmails };
}

function parseCourses(wb, leadMap) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['List of Courses'], { header: 1, defval: null });
  let header = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '') === 'Program' && String(rows[i][4] || '').toLowerCase().includes('course')) {
      header = i;
      break;
    }
  }
  const courses = [];
  for (let i = header + 1; i < rows.length; i++) {
    const program = cell(rows[i][0]);
    const name = cell(rows[i][4]);
    if (!name || !program) continue;
    if (/^total$/i.test(String(program))) continue;
    const rawCode = cell(rows[i][5]);
    const code = stableCourseCode(rawCode, name, leadMap);
    courses.push({
      program,
      sl: num(rows[i][1], null),
      year: cell(rows[i][2]),
      sem: cell(rows[i][3]),
      name,
      code,
      rawCode,
      courseType: cell(rows[i][6]),
      courseMode: cell(rows[i][8]),
      L: num(rows[i][9]),
      T: num(rows[i][10]),
      P: num(rows[i][11]),
      C: num(rows[i][12]),
      sections: num(rows[i][13]),
      studentStrength: num(rows[i][14]),
      leadFacultyName: leadMap?.[name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()]?.leadFacultyName || null,
    });
  }
  return courses;
}

function isBadSection(sec) {
  if (sec == null || sec === '') return true;
  if (typeof sec === 'number' && sec > 1000) return true; // excel date serials
  return false;
}

function parseWorkloadSheet(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { allocations: [], facultyTotals: {} };
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  // Find the detail header row that contains "Name of the course"
  let detailHeader = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const joined = (rows[i] || []).map((c) => String(c || '').toLowerCase()).join('|');
    if (joined.includes('name of the course') && joined.includes('course no')) {
      detailHeader = i;
      break;
    }
  }
  if (detailHeader < 0) return { allocations: [], facultyTotals: {} };

  // Column indices from Faculty WL / Course-wise layout:
  // 0 Sl, 1 Emp, 2 Name, 3 Designation, 4 Additional, 5 Prescribed,
  // 6 Program, 7 Year, 8 Course name, 9 Course no, 10 L, 11 T, 12 P, 13 C,
  // 14 Section, 15 students, 16 Total L, 17 Total T, 18 Total P, 19 hours/course/week, 20 total workload/week
  const allocations = [];
  const facultyTotals = {};
  let cur = { empCode: null, name: null, designation: null, prescribed: null, additionalDuties: null };

  for (let i = detailHeader + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const emp = empStr(r[1]);
    const name = cell(r[2]);
    if (emp || name) {
      cur = {
        empCode: emp || cur.empCode,
        name: name || cur.name,
        designation: cell(r[3]) || cur.designation,
        additionalDuties: cell(r[4]) || cur.additionalDuties,
        prescribed: cell(r[5]) || cur.prescribed,
      };
    }
    const courseName = cell(r[8]);
    const courseCodeRaw = cell(r[9]);
    if (!cur.empCode || !courseName) continue;

    const hoursCourse = num(r[19], null);
    const totalL = num(r[16], null);
    const totalT = num(r[17], null);
    const totalP = num(r[18], null);
    let hours = hoursCourse;
    if (hours == null || hours === 0) {
      hours = (totalL || 0) + (totalT || 0) + (totalP || 0);
    }
    if (!hours || hours <= 0) continue;

    let section = r[14];
    if (isBadSection(section)) section = null;
    else section = String(section);

    const code = stableCourseCode(courseCodeRaw, courseName, null);
    const totalWeek = num(r[20], null);
    if (totalWeek != null && totalWeek > 0) {
      facultyTotals[cur.empCode] = {
        empCode: cur.empCode,
        name: cur.name,
        prescribed: cur.prescribed,
        additionalDuties: cur.additionalDuties,
        totalWorkloadWeek: totalWeek,
      };
    }

    allocations.push({
      empCode: cur.empCode,
      name: cur.name,
      designation: cur.designation,
      prescribed: cur.prescribed,
      additionalDuties: cur.additionalDuties,
      program: cell(r[6]),
      year: cell(r[7]) ?? r[7],
      courseName,
      courseCode: code,
      courseCodeRaw,
      L: num(r[10]),
      T: num(r[11]),
      P: num(r[12]),
      C: num(r[13]),
      section,
      students: num(r[15], 70),
      hours,
      totalWorkloadWeek: totalWeek,
      sourceSheet: sheetName,
    });
  }
  return { allocations, facultyTotals };
}

function main() {
  if (!fs.existsSync(WORKBOOK)) {
    throw new Error(`Missing workbook: ${WORKBOOK}`);
  }
  const wb = XLSX.readFile(WORKBOOK);
  const emailBackfill = loadEmailBackfill();
  const lead = parseLeadFaculty(wb);
  const { faculty, missingEmails } = parseFL(wb, emailBackfill);
  const courses = parseCourses(wb, lead.byTitle);

  // Faculty WL is source of truth — keep every detail row (including identical keys).
  // Course-wise only fills missing faculty totals / prescribed bands.
  const fwl = parseWorkloadSheet(wb, 'Faculty WL');
  const cw = parseWorkloadSheet(wb, 'Course-wise');
  const allocations = fwl.allocations;

  const facultyTotals = { ...cw.facultyTotals, ...fwl.facultyTotals };

  // Attach prescribed / sheet total onto faculty
  for (const f of faculty) {
    const t = facultyTotals[f.empCode];
    if (t) {
      f.prescribed = t.prescribed;
      f.additionalDuties = t.additionalDuties;
      f.sheetTotalWorkloadWeek = t.totalWorkloadWeek;
    }
  }

  const report = {
    workbook: path.basename(WORKBOOK),
    facultyCount: faculty.length,
    facultyWithEmailFromSheet: faculty.filter((f) => f.emailFromSheet).length,
    missingEmails: missingEmails.length,
    coursesCount: courses.length,
    allocationsCount: allocations.length,
    facultyWithSheetTotal: Object.keys(facultyTotals).length,
    leadFacultyCount: lead.list.length,
    kpk: faculty.find((f) => f.empCode === '01350') || null,
    kpkAllocations: allocations.filter((a) => a.empCode === '01350'),
  };

  fs.writeFileSync(path.join(DATA_DIR, 'faculty.json'), JSON.stringify(faculty, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'courses.json'), JSON.stringify(courses, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'allocations.json'), JSON.stringify(allocations, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'lead-faculty.json'), JSON.stringify(lead.list, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'parse-report.json'), JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

module.exports = { main, DATA_DIR };
