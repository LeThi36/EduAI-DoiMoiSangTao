import { NextRequest, NextResponse } from 'next/server'
import { cloudinaryService, UploadCategory, CLOUDINARY_FOLDERS } from '@/lib/cloudinary/cloudinary.service'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

const ALLOWED_EXTENSIONS = [
  // Ảnh
  '.png', '.jpg', '.jpeg', '.webp', '.gif',
  // Tài liệu văn phòng
  '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls', '.pdf', '.txt',
  // Lập trình & Bài tập tiểu học
  '.sb3', '.sb2', // Scratch projects
  // Nén
  '.zip', '.rar',
]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const requestedCategory = formData.get('category') as string | null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Không tìm thấy tệp để tải lên' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Tệp tải lên không được rỗng (0 bytes)' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Dung lượng tệp vượt quá giới hạn tối đa cho phép (25 MB)' },
        { status: 400 }
      )
    }

    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Định dạng tệp ${ext} không được hỗ trợ. Vui lòng chọn ảnh (.png, .jpg), tài liệu (.docx, .pptx, .xlsx, .pdf) hoặc tệp Scratch (.sb3).` },
        { status: 400 }
      )
    }

    // Xác định phân loại thư mục
    let category: UploadCategory = 'student/submissions'

    if (requestedCategory && requestedCategory in CLOUDINARY_FOLDERS) {
      category = requestedCategory as UploadCategory
    } else if (file.type.startsWith('image/')) {
      category = requestedCategory?.startsWith('teacher') ? 'teacher/assignments' : 'student/images'
    } else if (ext === '.sb3' || ext === '.sb2') {
      category = 'student/scratch'
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await cloudinaryService.upload(buffer, file.name, file.type, category)

    return NextResponse.json(
      {
        message: 'Tải tệp lên Cloudinary thành công',
        attachment: {
          name: file.name,
          url: result.secureUrl,
          mimeType: file.type || 'application/octet-stream',
          size: result.bytes,
          publicId: result.publicId,
          category,
          folder: result.folder,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Upload API] Error uploading to Cloudinary:', error)
    return NextResponse.json(
      { error: error?.message || 'Không thể tải tệp lên đám mây Cloudinary' },
      { status: 500 }
    )
  }
}
