import { NextRequest, NextResponse } from 'next/server'
import { cloudinaryService } from '@/lib/cloudinary/cloudinary.service'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Không tìm thấy tệp đính kèm' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Mỗi tệp không được vượt quá 25 MB' }, { status: 400 })
    }

    // Tải trực tiếp lên Cloudinary vào thư mục giáo viên (teacher/assignments)
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await cloudinaryService.upload(buffer, file.name, file.type, 'teacher/assignments')

    return NextResponse.json({
      attachment: {
        name: file.name,
        url: result.secureUrl,
        mimeType: file.type || 'application/octet-stream',
        size: result.bytes,
        publicId: result.publicId,
      },
    })
  } catch (error: any) {
    console.error('Assignment attachment upload error:', error)
    return NextResponse.json(
      { error: error?.message || 'Không thể tải tệp đính kèm lên Cloudinary' },
      { status: 500 }
    )
  }
}
