import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuthUser = {
  id: string;
  role: string;
  departmentId?: string | null;
  schoolId?: string | null;
  facultyId?: string | null;
};

export async function loadFacultyOrThrow(
  prisma: PrismaService,
  facultyId: string,
) {
  const faculty = await prisma.faculty.findUnique({
    where: { id: facultyId },
    include: { department: true, user: true },
  });
  if (!faculty) throw new NotFoundException('Faculty not found');
  return faculty;
}

export async function assertCanAccessFaculty(
  prisma: PrismaService,
  user: AuthUser,
  facultyId: string,
) {
  const faculty = await loadFacultyOrThrow(prisma, facultyId);
  if (user.role === 'PRINCIPAL' || user.role === 'HR') return faculty;
  if (user.role === 'FACULTY') {
    if (user.facultyId !== faculty.id) {
      throw new ForbiddenException('Unauthorized access.');
    }
    return faculty;
  }
  if (user.role === 'HOD') {
    if (!user.departmentId || faculty.departmentId !== user.departmentId) {
      throw new ForbiddenException('Unauthorized access.');
    }
    return faculty;
  }
  if (user.role === 'DEAN') {
    if (!user.schoolId || faculty.department.schoolId !== user.schoolId) {
      throw new ForbiddenException('Unauthorized access.');
    }
    return faculty;
  }
  throw new ForbiddenException('Unauthorized access.');
}

export function assertDepartmentScope(user: AuthUser, departmentId: string) {
  if (user.role === 'PRINCIPAL' || user.role === 'HR') return;
  if (user.role === 'HOD' && user.departmentId === departmentId) return;
  throw new ForbiddenException('Unauthorized access.');
}

export async function assertDepartmentInSchool(
  prisma: PrismaService,
  user: AuthUser,
  departmentId: string,
) {
  if (user.role === 'PRINCIPAL' || user.role === 'HR') return;
  if (user.role === 'HOD' && user.departmentId === departmentId) return;
  if (user.role === 'DEAN') {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (dept && dept.schoolId === user.schoolId) return;
  }
  throw new ForbiddenException('Unauthorized access.');
}
