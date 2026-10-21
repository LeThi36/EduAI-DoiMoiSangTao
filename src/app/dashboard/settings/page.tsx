'use client'

import { useState } from 'react'
import { Settings, User, School, Bell, Shield, Save, CheckCircle2 } from 'lucide-react'

export default function SettingsPage() {
  const [fullName, setFullName] = useState('Thầy Nguyễn Văn An')
  const [email, setEmail] = useState('teacher@school.edu.vn')
  const [schoolName, setSchoolName] = useState('Trường Tiểu học Chu Văn An')
  const [saved, setSaved] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary-400" />
          Cài đặt Hệ thống & Tài khoản Giáo viên
        </h1>
        <p className="text-xs text-text-muted mt-1">
          Quản lý thông tin cá nhân giáo viên phụ trách môn Tin học và thông tin trường học.
        </p>
      </div>

      {saved && (
        <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/30 text-accent-300 text-xs flex items-center gap-2 animate-scale-in">
          <CheckCircle2 className="w-4 h-4 text-accent-400" />
          <span>Thông tin tài khoản đã được lưu thành công!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="glass-card gradient-border p-6 space-y-5">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <User className="w-4 h-4 text-primary-400" />
          Hồ sơ Giáo viên
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Họ và tên giáo viên *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input-field text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Email đăng nhập *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">
            Đơn vị công tác (Trường học) *
          </label>
          <input
            type="text"
            required
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            className="input-field text-sm"
          />
        </div>

        <div className="pt-4 border-t border-border-default/60 flex justify-end">
          <button type="submit" className="btn-primary text-xs flex items-center gap-2 py-2.5 px-5 shadow-lg shadow-primary-500/25">
            <Save className="w-4 h-4" />
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  )
}
