'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Building2,
  GraduationCap,
  Users,
  BookOpen,
  ClipboardCheck,
  Brain,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Sparkles,
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: string
}

const teacherNav: NavItem[] = [
  { name: 'Tổng quan', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Năm học', href: '/dashboard/school-years', icon: Calendar },
  { name: 'Khối lớp', href: '/dashboard/grades', icon: Building2 },
  { name: 'Lớp học', href: '/dashboard/classes', icon: GraduationCap },
  { name: 'Học sinh', href: '/dashboard/students', icon: Users },
  { name: 'Bài tập', href: '/dashboard/assignments', icon: BookOpen },
  { name: 'Chấm bài', href: '/dashboard/grading', icon: ClipboardCheck, badge: 'AI' },
  { name: 'Tiến bộ', href: '/dashboard/progress', icon: BarChart3 },
  { name: 'Cài đặt AI', href: '/dashboard/ai-settings', icon: Sparkles },
  { name: 'Cài đặt', href: '/dashboard/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<{ fullName: string; email: string; roleName: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user)
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    window.location.href = '/login'
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface-card border border-border-default text-text-muted hover:text-text-primary transition-colors"
        aria-label="Mở menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40
          bg-[rgba(255,255,255,0.97)] backdrop-blur-xl
          border-r border-border-default
          transition-all duration-300 ease-in-out
          flex flex-col
          ${collapsed ? 'w-20' : 'w-72'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo area */}
        <div className="flex items-center justify-between p-5 border-b border-border-default">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
              <Brain className="w-6 h-6 text-white" />
            </div>
            {!collapsed && (
              <div className="animate-fade-in">
                <h1 className="text-lg font-bold gradient-text">EduAI</h1>
                <p className="text-[10px] text-text-dim tracking-wider uppercase">Giáo dục thông minh</p>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setCollapsed(!collapsed)
              setMobileOpen(false)
            }}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-primary-50 text-text-dim hover:text-primary-600 transition-colors"
            aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {teacherNav.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <button
                key={item.href}
                onClick={() => {
                  router.push(item.href)
                  setMobileOpen(false)
                }}
                className={`
                  sidebar-link group relative
                  ${active ? 'active' : ''}
                  ${collapsed ? 'justify-center px-3' : ''}
                `}
                title={collapsed ? item.name : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-primary-400' : ''}`} />
                {!collapsed && (
                  <span className="flex-1">{item.name}</span>
                )}
                {!collapsed && item.badge && (
                  <span className="badge badge-primary text-[10px] py-0.5 px-2">
                    {item.badge}
                  </span>
                )}
                {collapsed && item.badge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-500 rounded-full" />
                )}
              </button>
            )
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-border-default p-4">
          {user && !collapsed && (
            <div className="flex items-center gap-3 mb-3 animate-fade-in">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {user.fullName?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.fullName || 'Giáo viên'}</p>
                <p className="text-xs text-text-dim truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`
              sidebar-link text-danger-400 hover:bg-danger-500/10
              ${collapsed ? 'justify-center px-3' : ''}
            `}
            title={collapsed ? 'Đăng xuất' : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
