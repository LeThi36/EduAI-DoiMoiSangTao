'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Brain, ArrowLeft, Send, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra')
        return
      }

      setIsSuccess(true)
    } catch {
      setError('Lỗi kết nối máy chủ')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-main">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 items-center justify-center mb-4 shadow-lg shadow-primary-500/30">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Quên mật khẩu?</h1>
          <p className="text-xs text-text-muted mt-1">
            Nhập email của bạn để nhận liên kết khôi phục mật khẩu tài khoản
          </p>
        </div>

        <div className="glass-card gradient-border p-8 space-y-6">
          {isSuccess ? (
            <div className="text-center space-y-3 animate-scale-in">
              <CheckCircle2 className="w-12 h-12 text-accent-400 mx-auto" />
              <h3 className="text-base font-bold text-text-primary">Đã gửi email khôi phục</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Vui lòng kiểm tra hòm thư <span className="text-text-primary font-semibold">{email}</span> để làm theo hướng dẫn.
              </p>
              <Link href="/login" className="btn-primary inline-flex items-center gap-2 text-xs mt-4">
                <ArrowLeft className="w-3.5 h-3.5" /> Quay lại Đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Email đăng ký tài khoản *
                </label>
                <input
                  type="email"
                  required
                  placeholder="teacher@school.edu.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full text-xs flex items-center justify-center gap-2 py-3"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Gửi yêu cầu đặt lại mật khẩu
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs text-primary-400 hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Quay lại trang Đăng nhập
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
