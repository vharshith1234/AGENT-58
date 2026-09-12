import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePerm } from '../common/permissions.guard';
import { FacultyPortalService } from './faculty.service';

const uploadRoot = join(process.cwd(), 'uploads', 'faculty');
if (!existsSync(uploadRoot)) mkdirSync(uploadRoot, { recursive: true });

@Controller('faculty')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FacultyController {
  constructor(private faculty: FacultyPortalService) {}

  @Get('me/workload')
  @RequirePerm('workload', 'view')
  me(@Req() req: { user: { facultyId?: string } }) {
    return this.faculty.meWorkload(req.user.facultyId);
  }

  @Get('me/projects')
  @RequirePerm('workload', 'view')
  projects(@Req() req: { user: { facultyId?: string } }) {
    return this.faculty.activityPortfolio(req.user.facultyId, 'projects');
  }

  @Get('me/research')
  @RequirePerm('workload', 'view')
  research(@Req() req: { user: { facultyId?: string } }) {
    return this.faculty.activityPortfolio(req.user.facultyId, 'research');
  }

  @Post('me/verify')
  @RequirePerm('workload', 'view')
  verify(
    @Req() req: { user: { facultyId?: string } },
    @Body() body: { note?: string },
  ) {
    return this.faculty.verify(req.user.facultyId, body.note);
  }

  @Post('me/corrections')
  @RequirePerm('corrections', 'submit')
  correction(
    @Req() req: { user: { id: string; facultyId?: string } },
    @Body()
    body: {
      issueCategory: string;
      description: string;
      targetRole?: string;
      currentValue?: string;
      expectedValue?: string;
    },
  ) {
    return this.faculty.submitCorrection(req.user.id, req.user.facultyId, body);
  }

  @Get('me/corrections')
  @RequirePerm('corrections', 'view')
  myCorrections(@Req() req: { user: { id: string } }) {
    return this.faculty.listMyCorrections(req.user.id);
  }

  @Post('me/photo')
  @RequirePerm('faculty', 'view')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: uploadRoot,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.jpg';
          const safe = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext)
            ? ext
            : '.jpg';
          cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${safe}`);
        },
      }),
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed') as any, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadPhoto(
    @Req() req: { user: { facultyId?: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Photo file is required');
    const relative = `/uploads/faculty/${file.filename}`;
    const updated = await this.faculty.updatePhoto(req.user.facultyId, relative);
    return updated;
  }

  @Delete('me/photo')
  @RequirePerm('faculty', 'view')
  removePhoto(@Req() req: { user: { facultyId?: string } }) {
    return this.faculty.removePhoto(req.user.facultyId);
  }

  @Get('me/statement.pdf')
  @RequirePerm('reports', 'view')
  async pdf(
    @Req() req: { user: { facultyId?: string } },
    @Res() res: Response,
  ) {
    const buf = await this.faculty.buildStatementPdf(req.user.facultyId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="workload-statement.pdf"',
    );
    res.send(buf);
  }

  @Get('me/statement.xlsx')
  @RequirePerm('reports', 'view')
  async xlsx(
    @Req() req: { user: { facultyId?: string } },
    @Res() res: Response,
  ) {
    const buf = await this.faculty.buildStatementExcel(req.user.facultyId);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="workload-statement.xlsx"',
    );
    res.send(buf);
  }

  @Get('me/statement.csv')
  @RequirePerm('reports', 'view')
  async csv(
    @Req() req: { user: { facultyId?: string } },
    @Res() res: Response,
  ) {
    const buf = await this.faculty.buildStatementCsv(req.user.facultyId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="workload-statement.csv"',
    );
    res.send(buf);
  }
}
