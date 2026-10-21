import crypto from 'node:crypto'

export type UploadCategory =
  | 'teacher/assignments' // Giáo viên: Tài liệu đính kèm đề bài (docx, pptx, pdf, xlsx, image)
  | 'teacher/curriculum'  // Giáo viên: Giáo án, đề cương, tài nguyên giảng dạy
  | 'student/submissions' // Học sinh: Bài thực hành nộp (docx, pptx, xlsx, pdf, txt, zip)
  | 'student/images'      // Học sinh: Ảnh chụp bài làm, bài vẽ Paint (png, jpg, jpeg)
  | 'student/scratch'     // Học sinh: Dự án Scratch (.sb3)
  | 'avatars'             // Ảnh đại diện người dùng

export interface CloudinaryUploadResult {
  url: string
  secureUrl: string
  publicId: string
  format: string
  bytes: number
  originalFilename: string
  resourceType: 'image' | 'raw' | 'video' | 'auto'
  folder: string
}

export const CLOUDINARY_FOLDERS: Record<UploadCategory, string> = {
  'teacher/assignments': 'eduai/teacher/assignments',
  'teacher/curriculum': 'eduai/teacher/curriculum',
  'student/submissions': 'eduai/student/submissions',
  'student/images': 'eduai/student/images',
  'student/scratch': 'eduai/student/scratch',
  'avatars': 'eduai/avatars',
}

class CloudinaryService {
  private get cloudName(): string {
    const val = process.env.CLOUDINARY_CLOUD_NAME?.trim()
    if (!val) {
      throw new Error('Biến môi trường CLOUDINARY_CLOUD_NAME chưa được cấu hình trong file .env')
    }
    return val
  }

  private get apiKey(): string {
    const val = process.env.CLOUDINARY_API_KEY?.trim()
    if (!val) {
      throw new Error('Biến môi trường CLOUDINARY_API_KEY chưa được cấu hình trong file .env')
    }
    return val
  }

  private get apiSecret(): string {
    const val = process.env.CLOUDINARY_API_SECRET?.trim()
    if (!val) {
      throw new Error('Biến môi trường CLOUDINARY_API_SECRET chưa được cấu hình trong file .env')
    }
    return val
  }

  /**
   * Tạo chữ ký xác thực SHA-1 theo chuẩn Cloudinary API
   */
  private generateSignature(params: Record<string, string | number>): string {
    const sortedKeys = Object.keys(params).sort()
    const serialized = sortedKeys
      .map((key) => `${key}=${params[key]}`)
      .join('&')

    return crypto
      .createHash('sha1')
      .update(`${serialized}${this.apiSecret}`)
      .digest('hex')
  }

  /**
   * Xác định resource_type phù hợp cho định dạng tệp
   */
  private detectResourceType(mimeType: string, filename: string): 'image' | 'raw' | 'video' | 'auto' {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'

    // Các tệp văn phòng và học tập tiểu học (Word, PowerPoint, Excel, Scratch .sb3, Zip, PDF)
    const rawExtensions = ['.docx', '.pptx', '.xlsx', '.pdf', '.sb3', '.zip', '.rar', '.txt']
    if (rawExtensions.some((ext) => filename.toLowerCase().endsWith(ext))) {
      return 'raw'
    }

    return 'auto'
  }

  /**
   * Tải tệp lên Cloudinary với phân loại thư mục chuyên biệt
   */
  async upload(
    fileBuffer: Buffer | ArrayBuffer,
    fileName: string,
    mimeType: string,
    category: UploadCategory = 'student/submissions'
  ): Promise<CloudinaryUploadResult> {
    const folder = CLOUDINARY_FOLDERS[category] || 'eduai/general'
    const resourceType = this.detectResourceType(mimeType, fileName)
    const timestamp = Math.floor(Date.now() / 1000)

    // Tạo public_id an toàn giữ lại tên tệp gốc để học sinh và giáo viên dễ nhận biết
    const sanitizedBase = fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_\u00C0-\u1EF9-]/g, '_')
      .slice(0, 50)
    const uniqueSuffix = Date.now().toString(36)
    const publicId = `${sanitizedBase}_${uniqueSuffix}`

    const signParams: Record<string, string | number> = {
      folder,
      public_id: publicId,
      timestamp,
    }

    const signature = this.generateSignature(signParams)

    // Chuẩn bị FormData để gọi trực tiếp Cloudinary REST API
    const formData = new FormData()
    const blob = new Blob([fileBuffer], { type: mimeType })
    formData.append('file', blob, fileName)
    formData.append('api_key', this.apiKey)
    formData.append('timestamp', timestamp.toString())
    formData.append('signature', signature)
    formData.append('folder', folder)
    formData.append('public_id', publicId)

    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Cloudinary] Upload error:', response.status, errorText)
      throw new Error(`Cloudinary upload failed: ${errorText}`)
    }

    const data = await response.json()

    return {
      url: data.url,
      secureUrl: data.secure_url,
      publicId: data.public_id,
      format: data.format || fileName.split('.').pop() || '',
      bytes: data.bytes,
      originalFilename: data.original_filename || fileName,
      resourceType,
      folder,
    }
  }

  /**
   * Xóa tệp khỏi Cloudinary bằng public_id
   */
  async delete(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'image'): Promise<boolean> {
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const signParams = {
        public_id: publicId,
        timestamp,
      }
      const signature = this.generateSignature(signParams)

      const formData = new FormData()
      formData.append('public_id', publicId)
      formData.append('api_key', this.apiKey)
      formData.append('timestamp', timestamp.toString())
      formData.append('signature', signature)

      const destroyUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/destroy`
      const res = await fetch(destroyUrl, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      return data.result === 'ok'
    } catch (err) {
      console.warn('[Cloudinary] Delete failed:', err)
      return false
    }
  }
}

export const cloudinaryService = new CloudinaryService()
