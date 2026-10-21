'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  AlertTriangle,
  Users,
  CheckCircle2,
  BookOpen,
  ChevronDown,
  Sparkles,
} from 'lucide-react'

export default function ProgressPage() {
  const [selectedClass, setSelectedClass] = useState('3/1')
  const [studentInsights, setStudentInsights] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/teacher/student-insights?className=${encodeURIComponent(selectedClass)}`)
      .then((r) => r.json())
      .then((d) => setStudentInsights(d.students || []))
      .catch(() => setStudentInsights([]))
  }, [selectedClass])

  const skillMetrics = [
    { name: 'Kỹ năng gõ phím 10 ngón', average: 9.1, status: 'Xuất sắc', progress: 91, color: 'accent' },
    { name: 'Soạn thảo văn bản Word', average: 8.4, status: 'Tốt', progress: 84, color: 'primary' },
    { name: 'Thiết kế trình chiếu PowerPoint', average: 8.8, status: 'Rất tốt', progress: 88, color: 'purple' },
    { name: 'Nhận thức An toàn Không gian mạng', average: 7.9, status: 'Đạt', progress: 79, color: 'warning' },
  ]

  const frequentMistakes = [
    { issue: 'Quên đặt ngón tay cái lên phím Spacebar khi gõ phím', count: '12 học sinh', level: 'Lớp 3/1' },
    { issue: 'Chọn màu chữ trùng với màu nền slide gây khó đọc', count: '8 học sinh', level: 'Lớp 4/1' },
    { issue: 'Chưa đặt tiêu đề căn giữa văn bản đúng quy chuẩn', count: '5 học sinh', level: 'Lớp 3/2' },
  ]

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary-400" />
            Theo dõi & Phân tích Tiến bộ Học tập
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Tổng hợp dữ liệu từ các bài đã được giáo viên duyệt. Nhận diện điểm sáng và các kỹ năng cần củng cố.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-text-dim">Xem theo lớp:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input-field text-xs py-2 bg-surface-main text-text-primary w-36"
          >
            <option value="3/1">Lớp 3/1</option>
            <option value="3/2">Lớp 3/2</option>
            <option value="4/1">Lớp 4/1</option>
            <option value="4/2">Lớp 4/2</option>
            <option value="5/1">Lớp 5/1</option>
          </select>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-muted text-xs font-semibold uppercase">Điểm trung bình lớp</span>
            <Award className="w-5 h-5 text-accent-400" />
          </div>
          <div className="text-3xl font-extrabold text-accent-400 font-mono">8.6 / 10</div>
          <p className="text-xs text-text-dim mt-1">Tăng +0.4 so với tháng trước</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-muted text-xs font-semibold uppercase">Tỉ lệ hoàn thành bài</span>
            <TrendingUp className="w-5 h-5 text-primary-400" />
          </div>
          <div className="text-3xl font-extrabold text-primary-300 font-mono">96.8%</div>
          <p className="text-xs text-text-dim mt-1">31/32 học sinh nộp đúng hạn</p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-muted text-xs font-semibold uppercase">Kỹ năng nổi bật</span>
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-text-primary mt-1">Gõ phím 10 ngón</div>
          <p className="text-xs text-text-dim mt-1">94% đạt chuẩn tốc độ lứa tuổi</p>
        </div>
      </div>

      {/* Grid: Skills & Common Mistakes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skills Progress */}
        <div className="glass-card gradient-border p-6 space-y-4">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-400" />
            Năng lực Tin học theo từng chủ đề
          </h2>

          <div className="space-y-4 pt-2">
            {skillMetrics.map((skill, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-secondary">{skill.name}</span>
                  <span className="font-mono font-bold text-accent-400">
                    {skill.average} đ ({skill.status})
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-surface-main overflow-hidden border border-border-default/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500"
                    style={{ width: `${skill.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Common Mistakes & Guidance */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning-400" />
            Lỗi hay gặp cần lưu ý trên lớp
          </h2>
          <p className="text-xs text-text-muted">
            AI tổng hợp từ các bài chấm để giáo viên dành 5-10 phút đầu giờ nhắc nhở cả lớp.
          </p>

          <div className="space-y-3 pt-2">
            {frequentMistakes.map((m, i) => (
              <div key={i} className="p-3 rounded-xl bg-surface-main/80 border border-border-default text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-warning-300">{m.issue}</span>
                  <span className="badge badge-warning text-[10px]">{m.count}</span>
                </div>
                <p className="text-text-dim text-[11px]">Phạm vi phát hiện: {m.level}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-student learning process */}
      <div className="glass-card gradient-border p-6 space-y-4">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-400" />
          Quá trình học tập từng học sinh – Lớp {selectedClass}
        </h2>
        <p className="text-xs text-text-muted">
          Tổng hợp từ các bài nộp và phân tích AI cho bài trắc nghiệm. Nhấn vào học sinh để xem chi tiết.
        </p>

        {studentInsights.length === 0 ? (
          <p className="text-xs text-text-dim">Lớp này chưa có học sinh hoặc dữ liệu.</p>
        ) : (
          <div className="space-y-2">
            {studentInsights.map((st) => {
              const open = expanded === st.studentId
              const TrendIcon = st.trend === 'up' ? TrendingUp : st.trend === 'down' ? TrendingDown : Minus
              return (
                <div key={st.studentId} className="rounded-xl bg-surface-main/70 border border-border-default">
                  <button
                    id={`student-insight-${st.studentId}`}
                    onClick={() => setExpanded(open ? null : st.studentId)}
                    className="w-full flex flex-wrap items-center gap-3 p-3 text-left text-xs hover:bg-surface-card/60 rounded-xl transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                      {st.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-semibold text-text-primary">{st.fullName}</p>
                      <p className="text-[11px] text-text-dim">{st.studentCode} • {st.submissionCount} bài đã nộp</p>
                    </div>
                    <span className="font-mono font-bold text-accent-400">
                      {st.averageScore ?? '--'} đ
                    </span>
                    {st.quizAccuracy !== null && (
                      <span className="badge badge-info text-[10px]">Trắc nghiệm đúng {st.quizAccuracy}%</span>
                    )}
                    {st.trend && (
                      <TrendIcon
                        className={`w-4 h-4 ${
                          st.trend === 'up' ? 'text-accent-400' : st.trend === 'down' ? 'text-danger-400' : 'text-text-dim'
                        }`}
                      />
                    )}
                    <ChevronDown className={`w-4 h-4 text-text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="px-4 pb-4 space-y-3 text-xs animate-fade-in">
                      {(st.weakConcepts.length > 0 || st.misconceptions.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {st.weakConcepts.length > 0 && (
                            <div className="p-3 rounded-lg bg-warning-500/10 border border-warning-500/20">
                              <span className="font-semibold text-warning-300">⚠️ Kiến thức còn yếu</span>
                              <ul className="list-disc ml-5 mt-1 text-text-muted text-[11px]">
                                {st.weakConcepts.map((w: string, i: number) => <li key={i}>{w}</li>)}
                              </ul>
                            </div>
                          )}
                          {st.misconceptions.length > 0 && (
                            <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20">
                              <span className="font-semibold text-danger-300">❌ Hiểu nhầm thường gặp</span>
                              <ul className="list-disc ml-5 mt-1 text-text-muted text-[11px]">
                                {st.misconceptions.map((w: string, i: number) => <li key={i}>{w}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {st.timeline.length === 0 ? (
                        <p className="text-text-dim">Học sinh chưa nộp bài nào.</p>
                      ) : (
                        <div className="space-y-2 border-l-2 border-border-default pl-3">
                          {st.timeline.map((t: any) => (
                            <div key={t.submissionId} className="space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-text-secondary">{t.assignmentTitle}</span>
                                <span className="font-mono text-accent-400">
                                  {t.score ?? '--'}/10
                                  {t.isQuiz && ` (${t.correctCount}/${t.totalQuestions} câu)`}
                                </span>
                              </div>
                              <p className="text-[11px] text-text-dim">
                                {new Date(t.submittedAt).toLocaleString('vi-VN')}
                              </p>
                              {t.insight && (
                                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] space-y-1">
                                  <p className="text-text-primary flex gap-1">
                                    <Sparkles className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                                    {t.insight.summary}
                                  </p>
                                  {t.insight.recommendation && (
                                    <p className="text-text-muted">💡 {t.insight.recommendation}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
