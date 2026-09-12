import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private resolvePhotoUrl(
    user: { photoUrl?: string | null; facultyId?: string | null },
    facultyPhoto?: string | null,
  ) {
    return user.photoUrl || facultyPhoto || null;
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    departmentId: string | null;
    schoolId: string | null;
    facultyId: string | null;
    photoUrl?: string | null;
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      schoolId: user.schoolId,
      facultyId: user.facultyId,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN') || '15m',
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') || '7d',
      },
    );

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        departmentId: user.departmentId,
        schoolId: user.schoolId,
        facultyId: user.facultyId,
      },
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const password = dto.password.trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email/user ID or password.');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email/user ID or password.');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Your account is currently inactive. Please contact the administrator.',
      );
    }
    const tokens = await this.issueTokens(user);
    let facultyPhoto: string | null = null;
    if (user.facultyId) {
      const fac = await this.prisma.faculty.findUnique({
        where: { id: user.facultyId },
        select: { photoUrl: true },
      });
      facultyPhoto = fac?.photoUrl ?? null;
    }
    return {
      ...tokens,
      user: {
        ...tokens.user,
        photoUrl: this.resolvePhotoUrl(user, facultyPhoto),
      },
    };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return { ok: true };
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    return { ok: true };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = await this.jwt.verifyAsync<{ sub: string }>(
        refreshToken,
        { secret: this.config.get('JWT_REFRESH_SECRET') },
      );
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const stored = await this.prisma.refreshToken.findFirst({
        where: { tokenHash, userId: decoded.sub },
      });
      if (!stored || stored.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
      });
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('User not available');
      }
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        faculty: {
          include: {
            department: true,
            affiliations: { include: { department: true } },
            adminRoles: true,
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    const facultyPhoto = user.faculty?.photoUrl ?? null;
    const roleLabels: Record<string, string> = {
      HR: 'Human Resources',
      HOD: 'Head of Department',
      DEAN: 'Dean',
      PRINCIPAL: 'Principal',
      FACULTY: 'Faculty',
    };
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      departmentId: user.departmentId,
      schoolId: user.schoolId,
      facultyId: user.facultyId,
      photoUrl: this.resolvePhotoUrl(user, facultyPhoto),
      designation:
        user.faculty?.designation || roleLabels[user.role] || user.role,
      departmentName:
        user.faculty?.department?.name ||
        user.department?.name ||
        null,
      additionalDepartments: (user.faculty as any)?.affiliations
        ?.filter((a: { isPrimary: boolean }) => !a.isPrimary)
        .map((a: { department: { name: string; code: string } }) => ({
          name: a.department.name,
          code: a.department.code,
        })) || [],
      administrativeRoles: (user.faculty as any)?.adminRoles?.map(
        (r: { roleName: string; scopeLabel: string | null }) => ({
          role: r.roleName,
          scope: r.scopeLabel,
        }),
      ) || [],
      employeeId: user.faculty?.employeeId || user.faculty?.facultyCode || null,
      facultyCode: user.faculty?.facultyCode || null,
      phone: user.faculty?.phone || null,
      qualification: user.faculty?.qualification || null,
      specialization: user.faculty?.specialization || null,
      researchInterests: (user.faculty as any)?.researchInterests || null,
      academicExperience: (user.faculty as any)?.academicExperience || null,
      education: (user.faculty as any)?.education || null,
      officialProfileUrl: (user.faculty as any)?.officialProfileUrl || null,
      dataSource: (user.faculty as any)?.dataSource || null,
      joiningDate: user.faculty?.joiningDate || null,
      employmentType: user.faculty?.employmentType || null,
    };
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; phone?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const name = dto.name?.trim();
    const phone = dto.phone?.trim();
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: name ? { name } : {},
    });
    if (user.facultyId && (name || phone != null)) {
      await this.prisma.faculty.update({
        where: { id: user.facultyId },
        data: {
          ...(name ? { name } : {}),
          ...(phone != null ? { phone } : {}),
        },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        userId,
        role: user.role,
        action: 'PROFILE_UPDATED',
        entity: 'User',
        entityId: userId,
        newValue: JSON.stringify({ name: name || undefined, phone: phone || undefined }),
      },
    });
    return this.me(updated.id);
  }

  async updatePhoto(userId: string, relativePath: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    await this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl: relativePath },
    });
    if (user.facultyId) {
      await this.prisma.faculty.update({
        where: { id: user.facultyId },
        data: { photoUrl: relativePath },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        userId,
        role: user.role,
        action: 'PROFILE_PICTURE_UPDATED',
        entity: 'User',
        entityId: userId,
        newValue: JSON.stringify({ photoUrl: relativePath }),
      },
    });
    return this.me(userId);
  }

  async removePhoto(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    await this.prisma.user.update({
      where: { id: userId },
      data: { photoUrl: null },
    });
    if (user.facultyId) {
      await this.prisma.faculty.update({
        where: { id: user.facultyId },
        data: { photoUrl: null },
      });
    }
    return this.me(userId);
  }

  async forgotPassword(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (user) {
      const hrs = await this.prisma.user.findMany({
        where: { role: 'HR', status: 'ACTIVE' },
      });
      for (const hr of hrs) {
        await this.prisma.notification.create({
          data: {
            userId: hr.id,
            title: 'Password reset requested',
            body: `${user.name} (${user.email}) requested a password reset.`,
          },
        });
      }
    }
    return { ok: true };
  }
}
