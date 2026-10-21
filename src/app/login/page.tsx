'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Eye, EyeOff, Sparkles, GraduationCap, Brain } from 'lucide-react'

export default function LoginPage() {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại. Vui lòng thử lại.')
        return
      }

      router.push(data.redirectTo || '/dashboard')
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại sau.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-950 via-surface-main to-primary-900 opacity-90" />
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-lg text-center">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Brain className="w-14 h-14 text-white" />
            </div>
          </div>

          <h1 className="text-5xl font-extrabold mb-4">
            <span className="gradient-text">EduAI</span>
          </h1>
          <p className="text-xl text-text-secondary mb-12 leading-relaxed">
            Nền tảng giáo dục thông minh dành cho
            <br />
            <span className="text-primary-400 font-semibold">Giáo viên Tin học Tiểu học</span>
          </p>

          {/* Feature cards */}
          <div className="space-y-4">
            <div className="glass-card p-4 flex items-center gap-4 text-left animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Quản lý lớp học</h3>
                <p className="text-text-muted text-xs">Tổ chức năm học, khối lớp và danh sách học sinh</p>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-4 text-left animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div className="w-12 h-12 rounded-xl bg-accent-500/20 flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6 text-accent-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Giao & chấm bài tập</h3>
                <p className="text-text-muted text-xs">Trắc nghiệm, tự luận và bài thực hành đa dạng</p>
              </div>
            </div>

            <div className="glass-card p-4 flex items-center gap-4 text-left animate-fade-in" style={{ animationDelay: '0.6s' }}>
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI hỗ trợ đánh giá</h3>
                <p className="text-text-muted text-xs">Chấm điểm thông minh theo rubric với Google Gemini</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 items-center justify-center mb-4 shadow-lg shadow-primary-500/30">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold gradient-text">EduAI</h1>
          </div>

          <div className="glass-card gradient-border p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Đăng nhập</h2>
              <p className="text-text-muted text-sm">
                Nhập thông tin tài khoản để truy cập hệ thống
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm animate-scale-in">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="account" className="block text-sm font-medium text-text-secondary mb-2">
                  Tài khoản hoặc Email
                </label>
                <input
                  id="account"
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="Tên đăng nhập (học sinh) hoặc email (giáo viên)"
                  required
                  className="input-field"
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input-field pr-12"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-secondary transition-colors"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-border-default bg-surface-input accent-primary-500" />
                  <span className="text-text-muted">Ghi nhớ đăng nhập</span>
                </label>
                <a href="/forgot-password" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                  Quên mật khẩu?
                </a>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-border-default text-center">
              <p className="text-text-dim text-xs">
                © 2026 EduAI — Nền tảng Giáo dục AI
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
