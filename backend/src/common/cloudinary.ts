import { v2 as cloudinary } from 'cloudinary'
import { Readable } from 'stream'
import { ConfigService } from '@nestjs/config'

let configured = false

export function configureCloudinary(config: ConfigService) {
  const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME')
  const apiKey = config.get<string>('CLOUDINARY_API_KEY')
  const apiSecret = config.get<string>('CLOUDINARY_API_SECRET')
  if (!cloudName || !apiKey || !apiSecret) {
    configured = false
    return false
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
  configured = true
  return true
}

export function isCloudinaryReady() {
  return configured
}

export function uploadImageBuffer(
  buffer: Buffer,
  folder: string,
  publicId?: string,
): Promise<{ url: string; publicId: string }> {
  if (!configured) {
    return Promise.reject(new Error('Cloudinary is not configured'))
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 600, height: 600, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (err, result) => {
        if (err || !result) {
          reject(err || new Error('Cloudinary upload failed'))
          return
        }
        resolve({ url: result.secure_url, publicId: result.public_id })
      },
    )
    Readable.from(buffer).pipe(stream)
  })
}

export async function destroyCloudinaryImage(photoUrlOrPublicId: string) {
  if (!configured) return
  let publicId = photoUrlOrPublicId
  if (photoUrlOrPublicId.includes('res.cloudinary.com')) {
    const parts = photoUrlOrPublicId.split('/')
    const uploadIdx = parts.findIndex((p) => p === 'upload')
    if (uploadIdx >= 0) {
      const after = parts.slice(uploadIdx + 1).join('/')
      publicId = after.replace(/\.[a-zA-Z0-9]+$/, '').replace(/^v\d+\//, '')
    }
  }
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch {
    /* ignore */
  }
}
