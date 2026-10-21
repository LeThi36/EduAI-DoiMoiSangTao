'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles,
  Bot,
  Sliders,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  FileCode2,
  BookOpen,
} from 'lucide-react'

export default function AISettingsPage() {
  const [settings, setSettings] = useState({
    provider: 'gemini',
    model: 'gemini-1.5-flash',
    isConnected: true,
    feedbackLanguage: 'vi',
    feedbackStyle: 'encouraging',
    feedbackDetail: 'standard',
    customPrompt: '',
    updatedAt: '',
  })

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/teacher/ai-settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings)
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/teacher/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetDefault = () => {
    setSettings((prev) => ({
      ...prev,
      feedbackLanguage: 'vi',
      feedbackStyle: 'encouraging',
      feedbackDetail: 'standard',
      customPrompt: '',
    }))
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            Cấu hình AI Chấm bài (Gemini AI Settings)
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Điều chỉnh phong cách nhận xét sư phạm tiểu học và kiểm soát prompt hướng dẫn AI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefault}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3"
          >
            <RotateCcw className="w-3.5 h-3.5 text-text-muted" />
            Khôi phục mặc định
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow-lg shadow-primary-500/25"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/30 text-accent-300 text-xs flex items-center gap-2 animate-scale-in">
          <CheckCircle2 className="w-4 h-4 text-accent-400" />
          <span>Cấu hình AI đã được lưu thành công vào hồ sơ giáo viên!</span>
        </div>
      )}

      {/* Config Forms */}
      <div className="max-w-4xl space-y-6">
          {/* Section A: AI Provider Status */}
          <div className="glass-card gradient-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base text-text-primary flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary-400" />
                Trạng thái Nhà cung cấp AI (Google Gemini)
              </h2>
              <span className="badge badge-success text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Kết nối an toàn
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-main/60 border border-border-default/60">
                <span className="text-text-dim block mb-1">Mô hình AI:</span>
                <span className="font-mono font-semibold text-primary-300">{settings.model}</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-main/60 border border-border-default/60">
                <span className="text-text-dim block mb-1">Lớp bảo vệ API:</span>
                <span className="font-semibold text-accent-400">Server-Side (Isolate)</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-main/60 border border-border-default/60 col-span-2 sm:col-span-1">
                <span className="text-text-dim block mb-1">Quyền quyết định:</span>
                <span className="font-semibold text-warning-400">Giáo viên phê duyệt</span>
              </div>
            </div>
            <p className="text-[11px] text-text-dim">
              * Khóa API được lưu trữ độc quyền trong biến môi trường máy chủ. Học sinh và giao diện người dùng không thể truy cập trực tiếp.
            </p>
          </div>

          {/* Section B: Pedagogical Style */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="font-bold text-base text-text-primary flex items-center gap-2">
              <Sliders className="w-5 h-5 text-accent-400" />
              Phong cách & Mức độ Nhận xét Sư phạm
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Phong cách nhận xét
                </label>
                <select
                  value={settings.feedbackStyle}
                  onChange={(e) => setSettings({ ...settings, feedbackStyle: e.target.value })}
                  className="input-field text-xs bg-surface-main text-text-primary"
                >
                  <option value="encouraging">Khích lệ, ấm áp & thân thiện (Tiểu học)</option>
                  <option value="concise">Ngắn gọn, súc tích, trực diện</option>
                  <option value="detailed">Giải thích chi tiết từng thao tác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Mức độ chi tiết
                </label>
                <select
                  value={settings.feedbackDetail}
                  onChange={(e) => setSettings({ ...settings, feedbackDetail: e.target.value })}
                  className="input-field text-xs bg-surface-main text-text-primary"
                >
                  <option value="standard">Tiêu chuẩn: Điểm mạnh + Góp ý + Hướng dẫn</option>
                  <option value="short">Ngắn gọn: Điểm mạnh & lỗi chính</option>
                  <option value="detailed">Chi tiết: Phân tích từng tiêu chí Rubric</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section C: Custom Teacher Prompt */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base text-text-primary flex items-center gap-2">
                <FileCode2 className="w-5 h-5 text-purple-400" />
                Hướng dẫn AI Tùy chỉnh (Prompt Chỉ đạo)
              </h2>
              <span className="text-xs text-text-dim">Áp dụng cho mọi bài tập</span>
            </div>

            <textarea
              rows={8}
              value={settings.customPrompt}
              onChange={(e) => setSettings({ ...settings, customPrompt: e.target.value })}
              className="input-field font-mono text-xs leading-relaxed"
              placeholder="Nhập hướng dẫn cụ thể cách AI ứng xử..."
            />
            <p className="text-[11px] text-text-dim">
              💡 Lưu ý: Hệ thống tự động lọc bỏ các chỉ dẫn sai lệch hoặc gian lận từ tệp tin do học sinh tải lên.
            </p>
          </div>
        </div>
      </div>
    )
  }
