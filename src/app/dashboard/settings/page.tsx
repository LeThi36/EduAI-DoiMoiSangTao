'use client'

import { useState, useEffect } from 'react'
import { Settings, User, School, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [schoolName, setSchoolName] = useState('Trường Tiểu học Chu Văn An')
  const [activeSchoolYear, setActiveSchoolYear] = useState('Năm học 2026 - 2027')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // 1. Tải thông tin giáo viên đang đăng nhập
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setFullName(data.user.fullName || '')
          setEmail(data.user.email || '')
        }
      })
      .catch((err) => console.error('Lỗi tải thông tin user:', err))
      .finally(() => setIsLoading(false))

    // 2. Tải năm học đang kích hoạt
    fetch('/api/school-years')
      .then((res) => res.json())
      .then((data) => {
        if (data.schoolYears) {
          const active = data.schoolYears.find((y: { isActive: boolean }) => y.isActive)
          if (active) setActiveSchoolYear(active.name)
        }
      })
      .catch(() => {})

    // 3. Tải đơn vị công tác từ localStorage nếu có
    if (typeof window !== 'undefined') {
      const savedSchool = localStorage.getItem('eduai_school_name')
      if (savedSchool) setSchoolName(savedSchool)
    }
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setIsSaving(true)

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu thay đổi.')
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('eduai_school_name', schoolName)
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new Event('user-updated'))
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3500)
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu thông tin.')
    } finally {
      setIsSaving(false)
    }
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
        <div className="p-3.5 rounded-xl bg-accent-500/10 border border-accent-500/30 text-accent-300 text-xs flex items-center gap-2 animate-scale-in">
          <CheckCircle2 className="w-4 h-4 text-accent-400 shrink-0" />
          <span>Thông tin tài khoản đã được lưu vào hệ thống thành công!</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-danger-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="glass-card gradient-border p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-border-default/60">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <User className="w-4 h-4 text-primary-400" />
            Hồ sơ Giáo viên
          </h2>
          {isLoading && (
            <span className="text-xs text-text-muted flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải dữ liệu...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Họ và tên giáo viên *
            </label>
            <input
              type="text"
              required
              disabled={isLoading}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên..."
              className="input-field text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Email đăng nhập (Tài khoản)
            </label>
            <input
              type="email"
              disabled
              value={email}
              className="input-field text-sm font-mono opacity-70 cursor-not-allowed bg-surface-main/60"
            />
            <p className="text-[11px] text-text-dim mt-1">Email định danh tài khoản, không thể thay đổi.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Đơn vị công tác (Trường học) *
            </label>
            <input
              type="text"
              required
              disabled={isLoading}
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="input-field text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Năm học hiện tại đang áp dụng
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-border-default bg-surface-main/60 text-xs text-text-secondary">
              <School className="w-4 h-4 text-primary-400 shrink-0" />
              <span className="font-medium text-text-primary">{activeSchoolYear}</span>
              <span className="ml-auto w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
            </div>
            <p className="text-[11px] text-text-dim mt-1">Được đồng bộ tự động từ phân hệ quản lý năm học.</p>
          </div>
        </div>

        <div className="pt-4 border-t border-border-default/60 flex justify-end">
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="btn-primary text-xs flex items-center gap-2 py-2.5 px-5 shadow-lg shadow-primary-500/25 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Lưu thay đổi
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
