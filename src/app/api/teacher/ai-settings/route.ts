import { NextRequest, NextResponse } from 'next/server'
import { AISettingsService } from '@/lib/ai/services/ai-settings.service'

export async function GET() {
  try {
    const settings = await AISettingsService.getSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching AI settings:', error)
    return NextResponse.json({ error: 'Không thể tải cấu hình AI' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const updated = await AISettingsService.updateSettings(body)
    return NextResponse.json({
      message: 'Cập nhật cấu hình AI thành công!',
      settings: updated,
    })
  } catch (error) {
    console.error('Error updating AI settings:', error)
    return NextResponse.json({ error: 'Lỗi khi cập nhật cấu hình AI' }, { status: 500 })
  }
}
