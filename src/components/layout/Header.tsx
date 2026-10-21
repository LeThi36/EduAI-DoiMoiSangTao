'use client'

import { useState, useEffect } from 'react'
import { Bell, School } from 'lucide-react'

export default function Header() {
  const [activeYear, setActiveYear] = useState('Năm học 2026 - 2027')
  const [schoolYears, setSchoolYears] = useState<{ id: string; name: string; isActive: boolean }[]>([])
  const [user, setUser] = useState<{
    fullName: string
    email: string
    roleName: string
  } | null>(null)

  useEffect(() => {
    // 1. Lấy thông tin năm học hiện tại
    fetch('/api/school-years')
      .then((res) => res.json())
      .then((data) => {
        if (data.schoolYears) {
          setSchoolYears(data.schoolYears)
          const active = data.schoolYears.find((y: { isActive: boolean }) => y.isActive)
          if (active) setActiveYear(active.name)
        }
      })
      .catch(() => {})

    // 2. Lấy thông tin tài khoản đang đăng nhập
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user)
      })
      .catch(() => {})
  }, [])

  const getInitials = (name?: string, role?: string) => {
    if (!name) return role === 'student' ? 'HS' : 'GV'
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length >= 2) {
      return (words[words.length - 2][0] + words[words.length - 1][0]).toUpperCase()
    }
    return (words[0]?.slice(0, 2) || (role === 'student' ? 'HS' : 'GV')).toUpperCase()
  }

  const getRoleLabel = (role?: string) => {
    if (role === 'teacher') return 'Giáo viên Tin học'
    if (role === 'student') return 'Học sinh'
    if (role === 'admin') return 'Quản trị viên'
    return 'Người dùng'
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-[rgba(255,255,255,0.86)] backdrop-blur-md border-b border-border-default shadow-sm shadow-primary-500/5">
      {/* Left: Active School Year Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-card border border-border-default text-xs font-medium text-text-secondary">
          <School className="w-4 h-4 text-primary-400" />
          <span>{activeYear}</span>
          <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />
        </div>
      </div>

      {/* Right: Quick actions & notification */}
      <div className="flex items-center gap-3">
        <button
          className="relative p-2 rounded-lg bg-surface-card border border-border-default text-text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors"
          title="Thông báo mới"
          aria-label="Thông báo"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full" />
        </button>

        {/* Current Logged-in User Profile */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-border-default">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-primary-500/20">
            {getInitials(user?.fullName, user?.roleName)}
          </div>
          <div className="hidden md:block text-left text-xs">
            <p className="font-semibold text-text-primary leading-tight">
              {user?.fullName || 'Tài khoản'}
            </p>
            <p className="text-text-dim text-[11px]">
              {getRoleLabel(user?.roleName)}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
