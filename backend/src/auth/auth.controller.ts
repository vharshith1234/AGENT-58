import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { extname, join } from 'path'
import { IsOptional, IsString, MinLength } from 'class-validator'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from './jwt-auth.guard'
import {
  configureCloudinary,
  destroyCloudinaryImage,
  isCloudinaryReady,
  uploadImageBuffer,
} from '../common/cloudinary'

class RefreshDto {
  @IsString()
  refreshToken!: string
}

class ForgotPasswordDto {
  @IsString()
  @MinLength(3)
  email!: string
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string

  @IsOptional()
  @IsString()
  phone?: string
}

const uploadRoot = join(process.cwd(), 'uploads', 'profiles')
if (!existsSync(uploadRoot)) mkdirSync(uploadRoot, { recursive: true })

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {
    configureCloudinary(this.config)
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto)
  }

  @Post('forgot')
  @HttpCode(200)
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email)
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken)
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user: { id: string } }) {
    return this.auth.me(req.user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(
    @Req() req: { user: { id: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(req.user.id, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp']
        if (!ok.includes(file.mimetype)) {
          cb(new BadRequestException('Only JPG, PNG, or WEBP images are allowed') as any, false)
          return
        }
        cb(null, true)
      },
    }),
  )
  async uploadPhoto(
    @Req() req: { user: { id: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) throw new BadRequestException('Photo file is required')

    configureCloudinary(this.config)

    if (isCloudinaryReady()) {
      const uploaded = await uploadImageBuffer(
        file.buffer,
        'agent58/profiles',
        `user-${req.user.id}`,
      )
      return this.auth.updatePhoto(req.user.id, uploaded.url)
    }

    const ext = extname(file.originalname).toLowerCase() || '.jpg'
    const safe = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg'
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}${safe}`
    writeFileSync(join(uploadRoot, filename), file.buffer)
    return this.auth.updatePhoto(req.user.id, `/uploads/profiles/${filename}`)
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/photo')
  async removePhoto(@Req() req: { user: { id: string } }) {
    const me = await this.auth.me(req.user.id)
    if (me.photoUrl?.includes('res.cloudinary.com')) {
      await destroyCloudinaryImage(me.photoUrl)
    }
    return this.auth.removePhoto(req.user.id)
  }
}
