/**
 * Remove duplicate faculty/user profiles only.
 * Does NOT touch CourseAllocation rows from the Odd-2026 workbook —
 * sheet teaching load must stay as imported.
 *
 * Run: node prisma/dedupe-database.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function scoreFaculty(f) {
  let s = 0;
  if (f.status === 'Active') s += 10;
  if (f.dataSource === 'REAL') s += 20;
  if (f.facultyCode && !String(f.facultyCode).startsWith('DEMO-')) s += 15;
  if (f.photoUrl) s += 5;
  if (f.user) {
    if (['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(f.user.role)) s += 50;
    if (f.user.status === 'ACTIVE') s += 5;
  }
  s += Math.min(f._count?.allocations || 0, 10);
  if (f.facultyCode && /^\d+$/.test(f.facultyCode)) s += 2;
  return s;
}

async function reassignThenDeleteFaculty(loserId, keepId) {
  // Move REAL sheet allocations / snapshots onto the kept profile
  await prisma.courseAllocation.updateMany({
    where: { facultyId: loserId, dataSource: 'REAL' },
    data: { facultyId: keepId },
  });
  await prisma.workloadSnapshot.updateMany({
    where: { facultyId: loserId, dataSource: 'REAL' },
    data: { facultyId: keepId },
  });
  await prisma.timetableSlot.updateMany({
    where: { facultyId: loserId, dataSource: 'REAL' },
    data: { facultyId: keepId },
  });

  // Drop DEMO leftovers on the duplicate profile
  await prisma.courseAllocation.deleteMany({
    where: { facultyId: loserId, dataSource: 'DEMO' },
  });
  await prisma.workloadSnapshot.deleteMany({ where: { facultyId: loserId } });
  await prisma.timetableSlot.deleteMany({ where: { facultyId: loserId } });
  await prisma.adminResponsibility.deleteMany({ where: { facultyId: loserId } });
  await prisma.researchCommitment.deleteMany({ where: { facultyId: loserId } });
  await prisma.committeeMembership.deleteMany({ where: { facultyId: loserId } });
  await prisma.phDSupervision.deleteMany({ where: { facultyId: loserId } });
  await prisma.project.deleteMany({
    where: { OR: [{ guideId: loserId }, { coGuideId: loserId }] },
  });
  await prisma.facultyAffiliation.deleteMany({ where: { facultyId: loserId } });

  await prisma.department.updateMany({
    where: { hodFacultyId: loserId },
    data: { hodFacultyId: keepId },
  });

  const user = await prisma.user.findFirst({ where: { facultyId: loserId } });
  if (user) {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.auditLog.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.correctionRequest
      .deleteMany({
        where: { OR: [{ submittedById: user.id }, { resolvedById: user.id }] },
      })
      .catch(() => {});
    await prisma.approvalAuditLog.deleteMany({ where: { actorId: user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } });
  }

  // Any remaining allocations on loser (shouldn't happen)
  await prisma.courseAllocation.deleteMany({ where: { facultyId: loserId } });
  await prisma.faculty.delete({ where: { id: loserId } });
}

async function dedupeFaculty() {
  const faculty = await prisma.faculty.findMany({
    include: {
      user: true,
      department: true,
      _count: { select: { allocations: true } },
    },
  });

  const report = { deactivated: [], deleted: [], kept: [], crossDeptCleared: [] };
  const handled = new Set();

  const byEmpDept = new Map();
  for (const f of faculty) {
    if (!f.employeeId) continue;
    const emp = String(f.employeeId).replace(/^0+/, '') || '0';
    const key = f.departmentId + '|' + emp;
    if (!byEmpDept.has(key)) byEmpDept.set(key, []);
    byEmpDept.get(key).push(f);
  }

  for (const [, rows] of byEmpDept) {
    if (rows.length < 2) continue;
    const ranked = [...rows].sort((a, b) => scoreFaculty(b) - scoreFaculty(a));
    const keep = ranked[0];
    handled.add(keep.id);
    report.kept.push({
      id: keep.id,
      email: keep.email,
      emp: keep.employeeId,
      code: keep.facultyCode,
      role: keep.user?.role,
    });

    for (const loser of ranked.slice(1)) {
      handled.add(loser.id);
      const deleteLoser =
        String(loser.facultyCode || '').startsWith('DEMO-') ||
        (loser.dataSource === 'DEMO' && keep.dataSource === 'REAL') ||
        (keep.user &&
          ['HR', 'HOD', 'DEAN', 'PRINCIPAL'].includes(keep.user.role) &&
          (!loser.user || loser.user.role === 'FACULTY'));

      if (deleteLoser) {
        await reassignThenDeleteFaculty(loser.id, keep.id);
        report.deleted.push({
          id: loser.id,
          email: loser.email,
          emp: loser.employeeId,
          code: loser.facultyCode,
          reason: 'duplicate-profile-of-' + keep.email,
        });
      } else {
        // Move REAL load, then deactivate profile
        await prisma.courseAllocation.updateMany({
          where: { facultyId: loser.id, dataSource: 'REAL' },
          data: { facultyId: keep.id },
        });
        await prisma.faculty.update({
          where: { id: loser.id },
          data: { status: 'Inactive' },
        });
        if (loser.user && loser.user.role === 'FACULTY') {
          await prisma.user.update({
            where: { id: loser.user.id },
            data: { status: 'INACTIVE' },
          });
        }
        report.deactivated.push({
          id: loser.id,
          email: loser.email,
          emp: loser.employeeId,
          code: loser.facultyCode,
          reason: 'duplicate-profile-of-' + keep.email,
        });
      }
    }
  }

  const remaining = await prisma.faculty.findMany({
    where: { status: 'Active' },
    include: {
      user: true,
      _count: { select: { allocations: true } },
    },
  });
  const byNameDept = new Map();
  for (const f of remaining) {
    const key = f.departmentId + '|' + f.name.toLowerCase().trim();
    if (!byNameDept.has(key)) byNameDept.set(key, []);
    byNameDept.get(key).push(f);
  }
  for (const [, rows] of byNameDept) {
    if (rows.length < 2) continue;
    const ranked = [...rows].sort((a, b) => scoreFaculty(b) - scoreFaculty(a));
    const keep = ranked[0];
    for (const loser of ranked.slice(1)) {
      if (handled.has(loser.id)) continue;
      const isDemo =
        String(loser.facultyCode || '').startsWith('DEMO-') || loser.dataSource === 'DEMO';
      if (!isDemo && !(keep.user && ['HOD', 'DEAN', 'PRINCIPAL', 'HR'].includes(keep.user.role))) {
        continue;
      }
      await reassignThenDeleteFaculty(loser.id, keep.id);
      report.deleted.push({
        id: loser.id,
        email: loser.email,
        emp: loser.employeeId,
        code: loser.facultyCode,
        reason: 'duplicate-name-profile-of-' + keep.email,
      });
    }
  }

  const cse = await prisma.department.findUnique({ where: { code: 'CSE' } });
  if (cse) {
    const hodUser = await prisma.user.findFirst({
      where: { role: 'HOD', status: 'ACTIVE', departmentId: cse.id },
    });
    if (hodUser?.facultyId) {
      await prisma.department.update({
        where: { id: cse.id },
        data: { hodFacultyId: hodUser.facultyId },
      });
    }
  }

  // Cross-department same employeeId: prefix DEMO emp ids only (no allocation deletes)
  const allFac = await prisma.faculty.findMany({
    select: {
      id: true,
      employeeId: true,
      dataSource: true,
      facultyCode: true,
      email: true,
      department: { select: { code: true } },
    },
  });
  const empGroups = new Map();
  for (const f of allFac) {
    if (!f.employeeId) continue;
    const emp = String(f.employeeId).replace(/^0+/, '') || '0';
    if (!empGroups.has(emp)) empGroups.set(emp, []);
    empGroups.get(emp).push(f);
  }
  for (const [, rows] of empGroups) {
    if (rows.length < 2) continue;
    const depts = new Set(rows.map((r) => r.department.code));
    if (depts.size < 2) continue;
    for (const f of rows) {
      if (f.dataSource === 'DEMO' || String(f.facultyCode || '').startsWith('DEMO-')) {
        if (String(f.employeeId).startsWith('DEMO-')) continue;
        await prisma.faculty.update({
          where: { id: f.id },
          data: { employeeId: 'DEMO-' + f.employeeId },
        });
        report.crossDeptCleared.push({
          email: f.email,
          emp: f.employeeId,
          dept: f.department.code,
        });
      }
    }
  }

  return report;
}

async function main() {
  const facultyReport = await dedupeFaculty();

  const summary = {
    note: 'Profile duplicates only — sheet CourseAllocation rows are never removed',
    facultyDeleted: facultyReport.deleted.length,
    facultyDeactivated: facultyReport.deactivated.length,
    facultyKeptFromDupGroups: facultyReport.kept.length,
    crossDeptEmpCleared: facultyReport.crossDeptCleared || [],
    deleted: facultyReport.deleted,
    deactivated: facultyReport.deactivated,
    kept: facultyReport.kept,
    remaining: {
      facultyActive: await prisma.faculty.count({ where: { status: 'Active' } }),
      cseActive: await prisma.faculty.count({
        where: { status: 'Active', department: { code: 'CSE' } },
      }),
      allocations: await prisma.courseAllocation.count(),
      realAllocations: await prisma.courseAllocation.count({ where: { dataSource: 'REAL' } }),
      users: await prisma.user.count({ where: { status: 'ACTIVE' } }),
    },
  };
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { main };
