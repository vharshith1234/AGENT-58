import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  private resolvePhotoUrl(
    user: { photoUrl?: string | null; facultyId?: string | null },
    facultyPhoto?: string | null,
  ) {
    return user.photoUrl || facultyPhoto || null;
  }

  private hashOtp(otp: string) {
    return createHash('sha256').update(otp).digest('hex');
  }

  private otpTtlMs() {
    return Number(this.config.get('OTP_EXPIRES_MINUTES') || 10) * 60 * 1000;
  }

  /** Resolve login by email or faculty / employee code */
  private async findUserByLogin(login: string) {
    const normalized = login.trim().toLowerCase();
    const raw = login.trim();
    let user = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (user) return user;

    const faculty = await this.prisma.faculty.findFirst({
      where: {
        OR: [
          { email: { equals: normalized, mode: 'insensitive' } },
          { facultyCode: raw },
          { employeeId: raw },
        ],
      },
      select: { id: true, email: true },
    });
    if (!faculty) return null;
    user = await this.prisma.user.findFirst({
      where: {
        OR: [{ facultyId: faculty.id }, { email: faculty.email.toLowerCase() }],
      },
    });
    return user;
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
    if (
      dto.expectedRole &&
      user.role !== dto.expectedRole &&
      user.role !== 'DEAN' &&
      user.role !== 'PRINCIPAL'
    ) {
      throw new ForbiddenException(
        `This account is ${user.role}. Please open the ${user.role} login.`,
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
    const userBag =
      (user as any).profileExtras && typeof (user as any).profileExtras === 'object'
        ? ((user as any).profileExtras as Record<string, any>)
        : {};
    const facultyBag =
      user.faculty?.profileExtras && typeof user.faculty.profileExtras === 'object'
        ? (user.faculty.profileExtras as Record<string, any>)
        : {};
    const extras = { ...userBag, ...facultyBag };

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
        user.faculty?.designation ||
        extras.designation ||
        roleLabels[user.role] ||
        user.role,
      departmentName:
        extras.departmentName ||
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
      employeeId:
        user.faculty?.employeeId ||
        user.faculty?.facultyCode ||
        extras.employeeId ||
        null,
      facultyCode: user.faculty?.facultyCode || extras.facultyCode || null,
      phone: user.faculty?.phone || extras.phone || null,
      qualification: user.faculty?.qualification || extras.qualification || null,
      specialization: user.faculty?.specialization || extras.specialization || null,
      researchInterests:
        (user.faculty as any)?.researchInterests || extras.researchInterests || null,
      academicExperience:
        (user.faculty as any)?.academicExperience ||
        extras.academicExperience ||
        null,
      education: (user.faculty as any)?.education || extras.education || null,
      profileExtras: Object.keys(extras).length ? extras : null,
      officialProfileUrl:
        (user.faculty as any)?.officialProfileUrl ||
        extras.officialProfileUrl ||
        null,
      dataSource: (user.faculty as any)?.dataSource || null,
      joiningDate: user.faculty?.joiningDate || extras.joiningDate || null,
      employmentType: user.faculty?.employmentType || extras.employmentType || null,
    };
  }

  async updateProfile(
    userId: string,
    dto: {
      name?: string;
      phone?: string;
      email?: string;
      designation?: string;
      departmentName?: string;
      specialization?: string;
      qualification?: string;
      employeeId?: string;
      facultyCode?: string;
      employmentType?: string;
      joiningDate?: string;
      researchInterests?: string;
      teachingEngagements?: string;
      academicExperience?: string;
      education?: string;
      officialProfileUrl?: string;
      profileExtras?: Record<string, unknown>;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const name = dto.name?.trim();
    const phone = dto.phone?.trim();
    const email = dto.email?.trim().toLowerCase();

    if (email && email !== user.email) {
      const taken = await this.prisma.user.findFirst({
        where: { email, NOT: { id: userId } },
      });
      if (taken) throw new BadRequestException('Email is already in use.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
      },
    });

    const extrasIn: Record<string, unknown> = {
      ...(dto.profileExtras && typeof dto.profileExtras === 'object'
        ? dto.profileExtras
        : {}),
    };
    if (dto.departmentName != null) {
      extrasIn.departmentName = String(dto.departmentName).trim();
    }

    const splitList = (raw?: string) =>
      String(raw || '')
        .split(/\n|;|·/)
        .map((s) => s.trim())
        .filter(Boolean);

    if (dto.researchInterests != null) {
      extrasIn.researchInterestsList = splitList(dto.researchInterests);
    }
    if (dto.teachingEngagements != null) {
      extrasIn.teachingEngagements = splitList(dto.teachingEngagements);
    }
    if (dto.academicExperience != null) {
      extrasIn.academicExperienceList = splitList(dto.academicExperience).map(
        (org) => ({ org, from: '', to: '' }),
      );
    }
    if (dto.education != null) {
      extrasIn.educationList = splitList(dto.education).map((degree) => ({
        degree,
        year: '',
      }));
    }

    if (user.facultyId) {
      const existing = await this.prisma.faculty.findUnique({
        where: { id: user.facultyId },
        select: { profileExtras: true },
      });
      const prev =
        existing?.profileExtras && typeof existing.profileExtras === 'object'
          ? (existing.profileExtras as Record<string, unknown>)
          : {};
      const nextExtras = { ...prev, ...extrasIn };

      let joiningDate: Date | null | undefined = undefined;
      if (dto.joiningDate != null) {
        const raw = String(dto.joiningDate).trim();
        joiningDate = raw ? new Date(raw) : null;
        if (joiningDate && Number.isNaN(joiningDate.getTime())) joiningDate = null;
      }

      try {
        await this.prisma.faculty.update({
          where: { id: user.facultyId },
          data: {
            ...(name ? { name } : {}),
            ...(email ? { email } : {}),
            ...(phone != null ? { phone } : {}),
            ...(dto.designation != null
              ? { designation: String(dto.designation).trim() || 'Faculty' }
              : {}),
            ...(dto.qualification != null
              ? { qualification: String(dto.qualification).trim() || '—' }
              : {}),
            ...(dto.specialization != null
              ? { specialization: String(dto.specialization).trim() || null }
              : {}),
            ...(dto.researchInterests != null
              ? { researchInterests: String(dto.researchInterests).trim() || null }
              : {}),
            ...(dto.academicExperience != null
              ? {
                  academicExperience:
                    String(dto.academicExperience).trim() || null,
                }
              : {}),
            ...(dto.education != null
              ? { education: String(dto.education).trim() || null }
              : {}),
            ...(dto.employeeId != null
              ? { employeeId: String(dto.employeeId).trim() || null }
              : {}),
            ...(dto.facultyCode != null
              ? { facultyCode: String(dto.facultyCode).trim() }
              : {}),
            ...(dto.employmentType != null
              ? { employmentType: String(dto.employmentType).trim() || 'Regular' }
              : {}),
            ...(joiningDate !== undefined ? { joiningDate } : {}),
            ...(dto.officialProfileUrl != null
              ? {
                  officialProfileUrl:
                    String(dto.officialProfileUrl).trim() || null,
                }
              : {}),
            profileExtras: nextExtras as any,
          },
        });
      } catch (e: any) {
        if (String(e?.code) === 'P2002') {
          throw new BadRequestException(
            'Employee ID, Faculty ID, or email must be unique.',
          );
        }
        throw e;
      }
    } else {
      const prev =
        (user as any).profileExtras && typeof (user as any).profileExtras === 'object'
          ? ((user as any).profileExtras as Record<string, unknown>)
          : {};
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          profileExtras: {
            ...prev,
            ...extrasIn,
            ...(phone != null ? { phone } : {}),
            ...(dto.designation != null
              ? { designation: String(dto.designation).trim() }
              : {}),
            ...(dto.qualification != null
              ? { qualification: String(dto.qualification).trim() }
              : {}),
            ...(dto.specialization != null
              ? { specialization: String(dto.specialization).trim() }
              : {}),
            ...(dto.researchInterests != null
              ? { researchInterests: String(dto.researchInterests).trim() }
              : {}),
            ...(dto.academicExperience != null
              ? { academicExperience: String(dto.academicExperience).trim() }
              : {}),
            ...(dto.education != null
              ? { education: String(dto.education).trim() }
              : {}),
            ...(dto.employeeId != null
              ? { employeeId: String(dto.employeeId).trim() }
              : {}),
            ...(dto.facultyCode != null
              ? { facultyCode: String(dto.facultyCode).trim() }
              : {}),
            ...(dto.employmentType != null
              ? { employmentType: String(dto.employmentType).trim() }
              : {}),
            ...(dto.joiningDate != null
              ? { joiningDate: String(dto.joiningDate).trim() }
              : {}),
            ...(dto.officialProfileUrl != null
              ? { officialProfileUrl: String(dto.officialProfileUrl).trim() }
              : {}),
          } as any,
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
        newValue: JSON.stringify({ name: name || undefined, email: email || undefined }),
      },
    });
    return this.me(userId);
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
    const login = email.trim();
    const generic = {
      ok: true,
      sent: false as boolean,
      message:
        'If an account exists for that Email / User ID, an OTP has been sent to that mailbox.',
    };

    const user = await this.findUserByLogin(login);
    if (!user || user.status !== 'ACTIVE') {
      return {
        ...generic,
        message:
          'No active account found for that Email / User ID. Use your registered login email.',
      };
    }

    // Always create + send a fresh OTP to the account's registered email
    const otp = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + this.otpTtlMs());

    await this.prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        email: user.email,
        otpHash: this.hashOtp(otp),
        expiresAt,
      },
    });

    let mailSent = false;
    let mailError = '';
    try {
      await this.mail.sendPasswordOtp(user.email, otp, user.name);
      mailSent = true;
    } catch (e: any) {
      mailError = e?.message || 'Failed to send OTP email';
      const allowDev =
        this.config.get('OTP_DEV_FALLBACK') === '1' ||
        this.config.get('NODE_ENV') !== 'production';
      if (!allowDev) {
        throw new BadRequestException('Unable to send OTP right now. Try again later.');
      }
      // Local/dev: keep OTP usable even if Brevo SMTP is not activated yet
      // eslint-disable-next-line no-console
      console.warn(`[OTP_DEV_FALLBACK] email=${user.email} otp=${otp}`);
    }

    const hrs = await this.prisma.user.findMany({
      where: { role: 'HR', status: 'ACTIVE' },
    });
    for (const hr of hrs) {
      await this.prisma.notification.create({
        data: {
          userId: hr.id,
          title: 'Password reset OTP sent',
          body: `${user.name} (${user.email}) requested a password reset OTP.`,
          kind: 'PASSWORD_RESET',
        },
      });
    }

    if (mailSent) {
      return {
        ok: true,
        sent: true,
        message: 'OTP sent to your registered email.',
        maskedEmail: this.maskEmail(user.email),
      };
    }

    return {
      ok: true,
      sent: true,
      message:
        'Brevo email is not activated yet. Use the on-screen OTP (dev fallback). Activate Brevo SMTP to receive real emails.',
      maskedEmail: this.maskEmail(user.email),
      // Only returned outside production / when OTP_DEV_FALLBACK=1
      devOtp: otp,
      brevoError: mailError.slice(0, 240),
    };
  }

  private maskEmail(email: string) {
    return email.replace(/(^.).*(@.*$)/, (_m, a, b) => `${a}***${b}`);
  }

  async verifyForgotOtp(email: string, otp: string) {
    const user = await this.findUserByLogin(email);
    if (!user) throw new BadRequestException('Invalid OTP or email.');

    const row = await this.prisma.passwordResetOtp.findFirst({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw new BadRequestException('OTP expired or not found. Request a new one.');

    if (row.attempts >= 5) {
      throw new BadRequestException('Too many attempts. Request a new OTP.');
    }

    const ok = row.otpHash === this.hashOtp(String(otp).trim());
    await this.prisma.passwordResetOtp.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    if (!ok) throw new BadRequestException('Invalid OTP.');

    const resetToken = await this.jwt.signAsync(
      { sub: user.id, purpose: 'password-reset', otpId: row.id },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '15m',
      },
    );

    return { ok: true, resetToken };
  }

  async resetPasswordWithToken(opts: {
    resetToken: string;
    newPassword: string;
  }) {
    const pwd = opts.newPassword?.trim() || '';
    if (pwd.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    let payload: { sub: string; purpose?: string; otpId?: string };
    try {
      payload = await this.jwt.verifyAsync(opts.resetToken, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new BadRequestException('Reset session expired. Start again.');
    }
    if (payload.purpose !== 'password-reset' || !payload.otpId) {
      throw new BadRequestException('Invalid reset token.');
    }

    const row = await this.prisma.passwordResetOtp.findUnique({
      where: { id: payload.otpId },
    });
    if (!row || row.userId !== payload.sub || row.consumedAt) {
      throw new BadRequestException('OTP already used or invalid. Start again.');
    }
    if (row.expiresAt < new Date()) {
      throw new BadRequestException('OTP expired. Request a new one.');
    }

    const passwordHash = await bcrypt.hash(pwd, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: payload.sub },
        data: { passwordHash },
      }),
      this.prisma.passwordResetOtp.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: payload.sub } }),
    ]);

    return { ok: true, message: 'Password updated. You can sign in now.' };
  }
}
