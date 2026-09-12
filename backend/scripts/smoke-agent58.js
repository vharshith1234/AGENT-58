const fs = require('fs');
const path = require('path');
const { loadCatalog } = require('../prisma/login-credentials');
const BASE = 'http://localhost:3000/api';

const catalog = loadCatalog();
const accounts = ['HR', 'HOD', 'DEAN', 'PRINCIPAL'].map((role) => {
  const row = catalog.find((r) => r.role === role);
  if (!row) throw new Error(`Missing ${role} login in login-credentials.json`);
  return [role, row.email, row.password];
});

async function api(method, path, token, body) {
  const t0 = Date.now();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, ms, json, text: text.slice(0, 240) };
}

function line(...args) {
  console.log(args.join(' '));
}

(async () => {
  const tokens = {};
  const users = {};
  line('=== LOGINS ===');
  for (const [role, email, password] of accounts) {
    const r = await api('POST', '/auth/login', null, { email, password });
    line(role, 'login', r.status, `${r.ms}ms`);
    if (r.json?.accessToken) {
      tokens[role] = r.json.accessToken;
      users[role] = r.json.user;
    }
  }

  line('\n=== AUTH ME + PROFILE PATCH ===');
  for (const role of ['HR', 'HOD', 'DEAN', 'PRINCIPAL', 'FACULTY-SKS']) {
    const me = await api('GET', '/auth/me', tokens[role]);
    line(
      role,
      'GET /auth/me',
      me.status,
      `${me.ms}ms`,
      `name=${me.json?.name}`,
      `phone=${me.json?.phone}`,
      `photo=${me.json?.photoUrl}`,
    );
  }
  const patch = await api('PATCH', '/auth/me', tokens['FACULTY-SKS'], {
    name: users['FACULTY-SKS']?.name,
    phone: '7981403193',
  });
  line('SKS PATCH /auth/me', patch.status, `${patch.ms}ms`, `phone=${patch.json?.phone}`);

  line('\n=== DASHBOARDS ===');
  const hod1 = await api('GET', '/hod/dashboard', tokens.HOD);
  line('HOD dashboard #1', hod1.status, `${hod1.ms}ms`, `faculty=${hod1.json?.totalFaculty}`, `avg=${hod1.json?.averageWorkload}`);
  const hod2 = await api('GET', '/hod/dashboard', tokens.HOD);
  line('HOD dashboard #2', hod2.status, `${hod2.ms}ms`, `faculty=${hod2.json?.totalFaculty}`);

  const hr1 = await api('GET', '/hr/dashboard', tokens.HR);
  line(
    'HR dashboard #1',
    hr1.status,
    `${hr1.ms}ms`,
    `faculty=${hr1.json?.facultyCount}`,
    `normal=${hr1.json?.normal}`,
    `over=${hr1.json?.overload}`,
    `under=${hr1.json?.underload}`,
  );
  const hr2 = await api('GET', '/hr/dashboard', tokens.HR);
  line('HR dashboard #2', hr2.status, `${hr2.ms}ms`);

  const dean = await api('GET', '/dean/dashboard', tokens.DEAN);
  line('Dean dashboard', dean.status, `${dean.ms}ms`, `faculty=${dean.json?.totalFaculty}`, `pending=${dean.json?.pending?.length}`);

  const prin1 = await api('GET', '/principal/dashboard', tokens.PRINCIPAL);
  line('Principal dashboard #1', prin1.status, `${prin1.ms}ms`, `faculty=${prin1.json?.totalFaculty}`);
  const prin2 = await api('GET', '/principal/dashboard', tokens.PRINCIPAL);
  line('Principal dashboard #2', prin2.status, `${prin2.ms}ms`);

  const fac = await api('GET', '/faculty/me/workload', tokens['FACULTY-SKS']);
  line('SKS workload', fac.status, `${fac.ms}ms`, `total=${fac.json?.breakdown?.total}`, `status=${fac.json?.breakdown?.status}`);

  const sum = await api('GET', '/workload/dashboard-summary', tokens.HR);
  line('HR dashboard-summary', sum.status, `${sum.ms}ms`, JSON.stringify(sum.json));

  line('\n=== SECURITY ===');
  const sskId = users['FACULTY-SSK']?.facultyId;
  const cross = await api('GET', `/workload/faculty/${sskId}`, tokens['FACULTY-SKS']);
  line('SKS GET SSK workload', cross.status, '(expect 403)', `${cross.ms}ms`);
  const instCsv = await api('GET', '/reports/institution/csv', tokens['FACULTY-SKS']);
  line('SKS institution CSV', instCsv.status, '(expect 403)', `${instCsv.ms}ms`);

  line('\n=== WHAT-IF ===');
  const sksId = users['FACULTY-SKS']?.facultyId;
  const before = await api('GET', `/workload/faculty/${sksId}`, tokens.HOD);
  const sim = await api('POST', '/workload/simulate', tokens.HOD, {
    facultyId: sksId,
    activityType: 'THEORY',
    additionalHours: 4,
  });
  const after = await api('GET', `/workload/faculty/${sksId}`, tokens.HOD);
  line(
    'simulate',
    sim.status,
    `${sim.ms}ms`,
    `current=${sim.json?.current?.total}`,
    `projected=${sim.json?.projected?.total}`,
    `status=${sim.json?.status}`,
    `alts=${sim.json?.alternatives?.length}`,
  );
  line(`totals before=${before.json?.total} after=${after.json?.total} (must match)`);

  const courses = await api('GET', '/hod/courses', tokens.HOD);
  line('\nHOD courses', courses.status, `${courses.ms}ms`, `count=${courses.json?.length}`);

  const out = {
    hod1: hod1.ms,
    hod2: hod2.ms,
    hr1: hr1.ms,
    hr2: hr2.ms,
    prin1: prin1.ms,
    prin2: prin2.ms,
    simMs: sim.ms,
    patchStatus: patch.status,
    crossStatus: cross.status,
    csvStatus: instCsv.status,
    before: before.json?.total,
    after: after.json?.total,
  };
  fs.writeFileSync(path.join(__dirname, 'smoke-results.json'), JSON.stringify(out, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
