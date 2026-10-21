import { prisma } from '@/lib/prisma'
import { AISettingsConfig } from '../types'
import { AI_CONFIG } from '../config/env'

export const AISettingsService = {
  /**
   * Lấy cấu hình AI trực tiếp từ Database Supabase (Prisma TeacherProfile).
   * Không lưu trên RAM hay biến toàn cục.
   */
  async getSettings(teacherId?: string): Promise<AISettingsConfig> {
    const isConnected = Boolean(AI_CONFIG.gemini.apiKey)

    try {
      const profile = await prisma.teacherProfile.findFirst({
        where: teacherId ? { OR: [{ id: teacherId }, { userId: teacherId }] } : undefined,
        orderBy: { updatedAt: 'desc' },
      })

      if (profile) {
        return {
          provider: 'gemini',
          model: AI_CONFIG.gemini.model || 'gemini-2.5-flash',
          isConnected,
          feedbackLanguage: profile.feedbackLanguage || 'vi',
          feedbackStyle: (profile.feedbackStyle as any) || 'encouraging',
          feedbackDetail: (profile.feedbackDetail as any) || 'standard',
          customPrompt: profile.customPrompt || '',
          updatedAt: profile.updatedAt.toISOString(),
        }
      }
    } catch (err) {
      console.warn('[AISettingsService] Không thể đọc teacherProfile từ Database:', err)
    }

    // Giá trị ban đầu khi chưa có hồ sơ giáo viên trong DB
    return {
      provider: 'gemini',
      model: AI_CONFIG.gemini.model || 'gemini-2.5-flash',
      isConnected,
      feedbackLanguage: 'vi',
      feedbackStyle: 'encouraging',
      feedbackDetail: 'standard',
      customPrompt: '',
      updatedAt: new Date().toISOString(),
    }
  },

  /**
   * Cập nhật cấu hình AI trực tiếp vào Database Supabase (TeacherProfile).
   */
  async updateSettings(
    newSettings: Partial<AISettingsConfig>,
    teacherId?: string
  ): Promise<AISettingsConfig> {
    try {
      let targetProfile = await prisma.teacherProfile.findFirst({
        where: teacherId ? { OR: [{ id: teacherId }, { userId: teacherId }] } : undefined,
        orderBy: { updatedAt: 'desc' },
      })

      if (!targetProfile) {
        // Nếu chưa có, tìm tài khoản giáo viên đầu tiên để tạo hồ sơ
        const firstTeacher = await prisma.user.findFirst({
          where: { role: { name: 'teacher' } },
        })

        if (firstTeacher) {
          targetProfile = await prisma.teacherProfile.upsert({
            where: { userId: firstTeacher.id },
            update: {},
            create: {
              userId: firstTeacher.id,
              feedbackLanguage: newSettings.feedbackLanguage || 'vi',
              feedbackStyle: newSettings.feedbackStyle || 'encouraging',
              feedbackDetail: newSettings.feedbackDetail || 'standard',
              customPrompt: newSettings.customPrompt || '',
            },
          })
        }
      }

      if (targetProfile) {
        await prisma.teacherProfile.update({
          where: { id: targetProfile.id },
          data: {
            ...(newSettings.feedbackLanguage ? { feedbackLanguage: newSettings.feedbackLanguage } : {}),
            ...(newSettings.feedbackStyle ? { feedbackStyle: newSettings.feedbackStyle } : {}),
            ...(newSettings.feedbackDetail ? { feedbackDetail: newSettings.feedbackDetail } : {}),
            ...(newSettings.customPrompt !== undefined ? { customPrompt: newSettings.customPrompt } : {}),
          },
        })
      }
    } catch (err) {
      console.error('[AISettingsService] Lỗi lưu cấu hình AI vào Database Supabase:', err)
      throw err
    }

    return await this.getSettings(teacherId)
  },
}
