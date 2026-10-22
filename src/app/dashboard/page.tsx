'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  GraduationCap,
  Users,
  BookOpen,
  ClipboardCheck,
  Sparkles,
  ArrowRight,
  Plus,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    classesCount: 0,
    studentsCount: 0,
    assignmentsCount: 0,
    pendingReviewsCount: 0,
  })

  const [classes, setClasses] = useState<{ id: string; name: string; studentCount: number; code: string }[]>([])
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<{ fullName: string } | null>(null)
  const [activeSchoolYear, setActiveSchoolYear] = useState('Năm học 2026 - 2027')
  const [recentAssignmentTitles, setRecentAssignmentTitles] = useState<string>('')
  const [gradeLevelsText, setGradeLevelsText] = useState<string>('Đang hoạt động')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 1. Lấy thông tin tài khoản hiện tại
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setCurrentUser(data.user)
      })
      .catch(() => {})

    // 2. Lấy năm học đang kích hoạt
    fetch('/api/school-years')
      .then((res) => res.json())
      .then((data) => {
        if (data.schoolYears) {
          const active = data.schoolYears.find((y: { isActive: boolean }) => y.isActive)
          if (active) setActiveSchoolYear(active.name)
        }
      })
      .catch(() => {})

    // 3. Đồng bộ toàn bộ dữ liệu thống kê trực tiếp từ Database
    Promise.all([
      fetch('/api/classes').then((res) => res.json()).catch(() => ({})),
      fetch('/api/students').then((res) => res.json()).catch(() => ({})),
      fetch('/api/assignments').then((res) => res.json()).catch(() => ({})),
      fetch('/api/submissions').then((res) => res.json()).catch(() => ({})),
    ]).then(([classesData, studentsData, assignmentsData, subsData]) => {
      const clsList = Array.isArray(classesData.classes) ? classesData.classes : []
      const stdList = Array.isArray(studentsData.students) ? studentsData.students : []
      const asgList = Array.isArray(assignmentsData.assignments) ? assignmentsData.assignments : []
      const subList = Array.isArray(subsData.submissions) ? subsData.submissions : []

      setClasses(clsList)

      // Xác định danh sách các khối lớp thực tế đang có trong DB
      const gradesSet = new Set<string>()
      clsList.forEach((c: any) => {
        const firstPart = (c.name || '').trim().split('/')[0]
        if (firstPart && !isNaN(Number(firstPart))) {
          gradesSet.add(`Khối ${firstPart}`)
        }
      })
      if (gradesSet.size > 0) {
        setGradeLevelsText(Array.from(gradesSet).sort().join(', '))
      } else {
        setGradeLevelsText('Đang hoạt động')
      }

      // Lọc các bài nộp AI đã chấm hoặc đang chờ giáo viên kiểm duyệt & công bố
      const pending = subList.filter((s: any) => !s.teacherReview || !s.teacherReview.isPublished)
      setPendingSubmissions(pending.length > 0 ? pending.slice(0, 5) : subList.slice(0, 5))

      // Tiêu đề các bài tập gần nhất
      if (asgList.length > 0) {
        setRecentAssignmentTitles(asgList.slice(0, 3).map((a: any) => a.title).join(', '))
      }

      // Tổng số học sinh: lấy từ bảng học sinh thực tế trong DB
      const actualStudentCount = stdList.length > 0
        ? stdList.length
        : clsList.reduce((sum: number, c: any) => sum + (Number(c.studentCount) || 0), 0)

      setStats({
        classesCount: clsList.length,
        studentsCount: actualStudentCount,
        assignmentsCount: asgList.length,
        pendingReviewsCount: pending.length,
      })
      setIsLoading(false)
    })
  }, [])

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl glass-card gradient-border p-6 md:p-8 bg-gradient-to-r from-primary-950/40 via-surface-card to-purple-950/30">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Nền tảng Giáo dục AI Tiểu học
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">
              Chào mừng, <span className="gradient-text">{currentUser?.fullName || 'Quý Thầy/Cô'}</span>
            </h1>
            <p className="text-text-muted text-sm max-w-2xl leading-relaxed">
              Quản lý {activeSchoolYear}, phân phối bài tập Tin học khối 3-5 và kiểm duyệt kết quả chấm điểm do Gemini AI hỗ trợ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard/assignments" className="btn-primary inline-flex items-center gap-2 text-sm shadow-lg shadow-primary-500/25">
              <Plus className="w-4 h-4" />
              Tạo bài tập mới
            </Link>
            <Link href="/dashboard/students" className="btn-secondary inline-flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" />
              Nhập học sinh
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-muted text-xs font-medium uppercase tracking-wider">Lớp học quản lý</span>
            <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center text-primary-400">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-primary mb-1">{stats.classesCount} Lớp</div>
          <p className="text-xs text-text-dim flex items-center gap-1">
            <span className="text-accent-400 font-medium">{gradeLevelsText}</span> • Đang hoạt động
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-muted text-xs font-medium uppercase tracking-wider">Tổng số học sinh</span>
            <div className="w-9 h-9 rounded-lg bg-accent-500/15 flex items-center justify-center text-accent-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-primary mb-1">{stats.studentsCount} Em</div>
          <p className="text-xs text-text-dim flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent-400" />
            <span>Đã cấp tài khoản 100%</span>
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-muted text-xs font-medium uppercase tracking-wider">Bài tập đang mở</span>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-primary mb-1">{stats.assignmentsCount} Bài</div>
          <p className="text-xs text-text-dim truncate" title={recentAssignmentTitles}>
            {recentAssignmentTitles || 'Đang sẵn sàng'}
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-muted text-xs font-medium uppercase tracking-wider">AI chờ giáo viên duyệt</span>
            <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-purple-400 mb-1">{stats.pendingReviewsCount} Bài làm</div>
          <p className="text-xs text-text-dim flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-warning-400" />
            <span>Cần kiểm duyệt & công bố</span>
          </p>
        </div>
      </div>

      {/* Grid: Classes & Pending AI Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Class Management Grid (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Danh sách Lớp học Tin học</h2>
              <p className="text-xs text-text-muted">Chọn nhanh lớp học để xem học sinh và giao bài</p>
            </div>
            <Link href="/dashboard/classes" className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center gap-1">
              Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {classes.length === 0 ? (
              <div className="col-span-full glass-card p-8 text-center text-text-muted text-sm space-y-2">
                <GraduationCap className="w-8 h-8 text-text-dim mx-auto mb-2 opacity-60" />
                <p>Chưa có lớp học nào được tạo.</p>
                <Link href="/dashboard/classes" className="text-primary-400 hover:underline inline-flex items-center gap-1 text-xs">
                  Tạo lớp học mới <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              classes.map((cls) => (
                <div
                  key={cls.id}
                  className="glass-card p-4 hover:border-primary-500/50 cursor-pointer group transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-cyan-500/20 flex items-center justify-center font-bold text-primary-300 text-lg group-hover:scale-105 transition-transform">
                      {cls.name}
                    </div>
                    <span className="badge badge-primary text-[10px]">{cls.code}</span>
                  </div>
                  <h3 className="font-semibold text-sm text-text-primary mb-1">Lớp {cls.name}</h3>
                  <p className="text-xs text-text-muted mb-3">{cls.studentCount} Học sinh</p>
                  <div className="flex items-center justify-between pt-2 border-t border-border-default/60 text-xs">
                    <span className="text-accent-400 font-medium">Đang học</span>
                    <Link href={`/dashboard/students?classId=${cls.id}`} className="text-primary-400 hover:underline flex items-center gap-1">
                      Danh sách <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: AI Grading Queue (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Hàng chờ duyệt điểm AI
              </h2>
              <p className="text-xs text-text-muted">AI đề xuất - Giáo viên quyết định</p>
            </div>
            <Link href="/dashboard/grading" className="text-xs font-semibold text-primary-400 hover:text-primary-300">
              Chấm ngay
            </Link>
          </div>

          <div className="space-y-3">
            {pendingSubmissions.length === 0 ? (
              <div className="glass-card p-6 text-center text-text-muted text-xs space-y-1.5">
                <ClipboardCheck className="w-6 h-6 text-accent-400 mx-auto mb-1 opacity-70" />
                <p className="font-medium text-text-primary">Không có bài làm nào đang chờ duyệt</p>
                <p className="text-[11px] text-text-dim">Tất cả bài thi hoặc bài tập đã được duyệt hoàn tất.</p>
              </div>
            ) : (
              pendingSubmissions.map((sub) => (
                <div key={sub.id} className="glass-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-semibold text-sm text-text-primary">{sub.studentName}</span>
                      <span className="ml-2 text-xs text-text-dim">({sub.className})</span>
                    </div>
                    {sub.aiEvaluation && (
                      <span className="badge badge-success text-xs font-bold">
                        AI: {sub.aiEvaluation.score}/10
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-text-muted line-clamp-2">
                    {sub.assignmentTitle}
                  </p>

                  {sub.aiEvaluation && (
                    <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 space-y-1">
                      <p className="font-medium">✨ Nhận xét AI:</p>
                      <p className="text-[11px] text-text-muted line-clamp-2">{sub.aiEvaluation.strengths || sub.aiEvaluation.weaknesses || 'Đã chấm điểm hoàn tất'}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-text-dim">
                      {new Date(sub.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Link
                      href={`/dashboard/grading?submissionId=${sub.id}`}
                      className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center gap-1"
                    >
                      Xem & Duyệt điểm <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
