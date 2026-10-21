'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Brain,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  Send,
  Upload,
  FileText,
  LogOut,
  Award,
  AlertTriangle,
  Timer,
  RotateCcw,
  RefreshCw,
  Flame,
  ArrowRight,
  ArrowLeft,
  Play,
  CheckCircle,
  HelpCircle,
  X,
} from 'lucide-react'

type Assignment = {
  id: string
  title: string
  description?: string
  type: 'multiple_choice' | 'essay' | 'practice'
  gradeLevel: number
  targetClassIds?: string[]
  maxScore: number
  durationMinutes?: number
  maxAttempts?: number
  startDate?: string
  dueDate?: string
  questions?: Array<{
    id: string
    content: string
    type?: string
    options?: Array<{ label: string; text: string; isCorrect?: boolean }>
    maxScore?: number
  }>
  attachments?: Array<{ name: string; url: string }>
}

type Submission = {
  id: string
  assignmentId: string
  assignmentTitle: string
  studentId: string
  studentName: string
  studentCode: string
  className: string
  status: string
  submittedAt: string
  attemptNumber?: number
  isAutoSubmitted?: boolean
  content?: string
  fileName?: string
  quizResult?: any
  aiEvaluation?: any
  teacherReview?: {
    finalScore: number
    feedback: string
    reviewedAt: string
    isPublished: boolean
  }
}

export default function StudentDashboardPage() {
  const [student, setStudent] = useState({
    id: '',
    fullName: '',
    studentId: '',
    className: '',
    classId: '',
    gradeLevel: 3,
  })

  const [allAssignments, setAllAssignments] = useState<Assignment[]>([])
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([])
  
  // Navigation tabs: 'assignments' (default) | 'results'
  const [activeTab, setActiveTab] = useState<'assignments' | 'results'>('assignments')
  
  // Exam taking state: only true when student clicks "Bắt đầu làm bài"
  const [isTakingExam, setIsTakingExam] = useState<boolean>(false)
  const [activeAssignmentId, setActiveAssignmentId] = useState<string>('')

  // Answers state for current exam
  const [answers, setAnswers] = useState<Record<string, { selectedLabel?: string; text?: string }>>({})
  const [submissionText, setSubmissionText] = useState('')
  const [uploadedFile, setUploadedFile] = useState<{
    name: string
    url: string
    size: number
    mimeType?: string
  } | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [uploadFileError, setUploadFileError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isAutoSubmittedDone, setIsAutoSubmittedDone] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Countdown timer state
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)
  const [totalTimeSeconds, setTotalTimeSeconds] = useState<number | null>(null)
  const [settingNotice, setSettingNotice] = useState<string | null>(null)

  // Refs for current answers & submitting state inside intervals/auto-submit
  const answersRef = useRef(answers)
  answersRef.current = answers
  const submissionTextRef = useRef(submissionText)
  submissionTextRef.current = submissionText
  const uploadedFileRef = useRef(uploadedFile)
  uploadedFileRef.current = uploadedFile
  const isSubmittingRef = useRef(isSubmitting)
  isSubmittingRef.current = isSubmitting

  const handleFileUpload = async (file: File) => {
    if (!file) return
    setIsUploadingFile(true)
    setUploadFileError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      const category = file.type.startsWith('image/')
        ? 'student/images'
        : file.name.endsWith('.sb3')
          ? 'student/scratch'
          : 'student/submissions'
      formData.append('category', category)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Tải tệp lên Cloudinary thất bại')
      }

      setUploadedFile({
        name: data.attachment.name,
        url: data.attachment.url,
        size: data.attachment.size,
        mimeType: data.attachment.mimeType,
      })
    } catch (err: any) {
      setUploadFileError(err.message || 'Lỗi khi tải tệp lên Cloudinary')
    } finally {
      setIsUploadingFile(false)
    }
  }

  const TYPE_LABELS: Record<string, string> = {
    multiple_choice: 'Trắc nghiệm tự động chấm',
    essay: 'Tự luận trả lời câu hỏi',
    practice: 'Bài thực hành máy tính',
  }

  // Filter ONLY assignments that match this student's grade level and class
  const studentAssignments = allAssignments.filter((asg) => {
    if (asg.gradeLevel && asg.gradeLevel !== student.gradeLevel) return false
    if (asg.targetClassIds && asg.targetClassIds.length > 0 && student.classId) {
      return asg.targetClassIds.includes(student.classId)
    }
    return true
  })

  // Active assignment: when taking exam
  const activeAssignment: Assignment | undefined =
    studentAssignments.find((a) => a.id === activeAssignmentId)

  // Submissions for a specific assignment
  const getSubmissionsForAssignment = (assignmentId: string) => {
    return mySubmissions.filter((s) => s.assignmentId === assignmentId)
  }

  const currentAttempts = activeAssignment ? getSubmissionsForAssignment(activeAssignment.id).length : 0
  const maxAttempts = activeAssignment?.maxAttempts ?? 0
  const hasReachedLimit = maxAttempts > 0 && currentAttempts >= maxAttempts

  // 1. Fetch current student from session
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          const info = data.user.studentInfo
          const gradeLevel =
            info?.gradeLevel ||
            (info?.className ? parseInt(info.className.charAt(0)) : undefined) ||
            3

          setStudent((prev) => ({
            ...prev,
            id: info?.id || data.user.id || prev.id,
            fullName: info?.fullName || data.user.fullName || prev.fullName,
            studentId: info?.studentId || data.user.id || prev.studentId,
            className: info?.className || prev.className,
            classId: info?.classId || prev.classId,
            gradeLevel,
          }))
        }
      })
      .catch(() => {})
  }, [])

  // 2. Fetch assignments and submissions
  const loadData = async (isBackgroundPoll = false) => {
    try {
      const [asgRes, subRes] = await Promise.all([
        fetch('/api/assignments'),
        fetch('/api/submissions'),
      ])

      if (asgRes.ok) {
        const asgData = await asgRes.json()
        if (asgData.assignments && Array.isArray(asgData.assignments)) {
          setAllAssignments((prev) => {
            // Check if duration changed for currently active assignment
            if (activeAssignmentId && isTakingExam) {
              const prevActive = prev.find((a) => a.id === activeAssignmentId)
              const newActive = asgData.assignments.find((a: Assignment) => a.id === activeAssignmentId)
              if (
                prevActive &&
                newActive &&
                prevActive.durationMinutes !== newActive.durationMinutes
              ) {
                setSettingNotice(
                  `⏱️ Thầy/Cô vừa cập nhật thời gian làm bài: ${newActive.durationMinutes ? `${newActive.durationMinutes} phút` : 'Không giới hạn'}`
                )
                setTimeout(() => setSettingNotice(null), 4000)
              }
            }
            return asgData.assignments
          })
        }
      }

      if (subRes.ok) {
        const subData = await subRes.json()
        if (subData.submissions && Array.isArray(subData.submissions)) {
          // Strictly filter by student code or ID
          const mine = subData.submissions.filter(
            (s: any) => s.studentCode === student.studentId || s.studentId === student.id
          )
          setMySubmissions(mine)
        }
      }
    } catch (err) {
      if (!isBackgroundPoll) console.error('Error loading data:', err)
    }
  }

  useEffect(() => {
    loadData()

    // Poll every 5s so teacher setting changes take effect
    const pollInterval = setInterval(() => {
      loadData(true)
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [activeAssignmentId, student.studentId, student.id, student.gradeLevel, student.classId, isTakingExam])

  // Check if student was in the middle of taking an exam (restore from session)
  useEffect(() => {
    try {
      const savedExamId = sessionStorage.getItem(`eduai_active_exam_${student.studentId}`)
      if (savedExamId && studentAssignments.some((a) => a.id === savedExamId)) {
        setActiveAssignmentId(savedExamId)
        setIsTakingExam(true)
      }
    } catch {}
  }, [student.studentId, studentAssignments.length])

  // 3. Countdown timer logic ONLY RUNS when student is actively taking the exam
  useEffect(() => {
    if (!isTakingExam || !activeAssignment) {
      setSecondsRemaining(null)
      setTotalTimeSeconds(null)
      return
    }

    const durationMin = Number(activeAssignment.durationMinutes) || 0
    if (durationMin <= 0) {
      setSecondsRemaining(null)
      setTotalTimeSeconds(null)
      return
    }

    const totalSeconds = durationMin * 60
    setTotalTimeSeconds(totalSeconds)

    // Storage key includes studentId and assignmentId
    const storageKey = `eduai_quiz_session_${student.studentId}_${activeAssignment.id}`
    const now = Date.now()

    let session: { startTime: number; durationMinutes: number } | null = null
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) session = JSON.parse(raw)
    } catch {}

    // If teacher updated durationMinutes OR fresh session, initialize to teacher's latest durationMinutes
    if (!session || session.durationMinutes !== durationMin) {
      session = { startTime: now, durationMinutes: durationMin }
      localStorage.setItem(storageKey, JSON.stringify(session))
    }

    const elapsed = Math.floor((now - session.startTime) / 1000)
    const remaining = Math.max(0, totalSeconds - elapsed)

    setSecondsRemaining(remaining)

    // Tick every 1 second
    const timerId = setInterval(() => {
      let currentSession: { startTime: number; durationMinutes: number } | null = null
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) currentSession = JSON.parse(raw)
      } catch {}

      const sTime = currentSession?.startTime || now
      const currentElapsed = Math.floor((Date.now() - sTime) / 1000)
      const currentRemaining = Math.max(0, totalSeconds - currentElapsed)

      setSecondsRemaining(currentRemaining)

      // Time expired: trigger automatic submission
      if (currentRemaining <= 0) {
        clearInterval(timerId)
        localStorage.removeItem(storageKey)
        triggerAutoSubmit()
      }
    }, 1000)

    return () => clearInterval(timerId)
  }, [isTakingExam, activeAssignment?.id, activeAssignment?.durationMinutes, student.studentId])

  // Handler: Student explicitly clicks "Bắt đầu làm bài"
  const handleStartExam = (asg: Assignment) => {
    const attempts = getSubmissionsForAssignment(asg.id).length
    if (asg.maxAttempts && asg.maxAttempts > 0 && attempts >= asg.maxAttempts) {
      alert(`Em đã hoàn thành tối đa số lần làm bài quy định (${attempts}/${asg.maxAttempts} lần) cho bài kiểm tra này.`)
      return
    }

    setActiveAssignmentId(asg.id)
    setAnswers({})
    setSubmissionText('')
    setUploadedFile(null)
    setUploadFileError('')
    setSubmitError('')
    setSubmitSuccess(false)
    setIsAutoSubmittedDone(false)
    setIsTakingExam(true)

    // Save in session storage so F5 keeps the exam open
    try {
      sessionStorage.setItem(`eduai_active_exam_${student.studentId}`, asg.id)
      // Reset timer start time for a fresh attempt
      const storageKey = `eduai_quiz_session_${student.studentId}_${asg.id}`
      if (asg.durationMinutes && asg.durationMinutes > 0) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ startTime: Date.now(), durationMinutes: asg.durationMinutes })
        )
      }
    } catch {}
  }

  // Handler: Cancel / Exit exam back to assignment list
  const handleExitExam = () => {
    if (
      Object.keys(answers).length > 0 ||
      submissionText.trim() ||
      uploadedFile
    ) {
      const confirmExit = confirm(
        'Em đang trong quá trình làm bài. Nếu quay lại danh sách bài tập, bài làm chưa nộp có thể không được lưu. Em có chắc chắn muốn quay lại không?'
      )
      if (!confirmExit) return
    }

    try {
      sessionStorage.removeItem(`eduai_active_exam_${student.studentId}`)
    } catch {}

    setIsTakingExam(false)
    setActiveAssignmentId('')
    setSecondsRemaining(null)
  }

  // 4. Trigger auto-submit when timer hits 00:00
  const triggerAutoSubmit = async () => {
    if (isSubmittingRef.current || !activeAssignment) return
    setIsSubmitting(true)
    setSubmitError('')
    setIsAutoSubmittedDone(true)

    try {
      const type = activeAssignment.type
      const currentAnswers = answersRef.current
      const currentText = submissionTextRef.current
      const currentFile = uploadedFileRef.current

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: activeAssignment.id,
          studentId: student.id,
          content: type === 'practice' ? currentText : '',
          fileName: type === 'practice' ? (currentFile?.name || '') : '',
          fileUrl: type === 'practice' ? (currentFile?.url || '') : '',
          answers: Object.entries(currentAnswers).map(([questionId, a]) => ({ questionId, ...a })),
          isAutoSubmitted: true,
        }),
      })

      if (res.ok) {
        setSubmitSuccess(true)
        setSubmitMessage('Hết giờ làm bài! Hệ thống đã tự động thu bài và nộp lên hệ thống.')
        loadData()
        try {
          sessionStorage.removeItem(`eduai_active_exam_${student.studentId}`)
        } catch {}
        setTimeout(() => {
          setIsTakingExam(false)
          setActiveTab('results')
          setSubmitSuccess(false)
          setIsAutoSubmittedDone(false)
        }, 2500)
      } else {
        const data = await res.json().catch(() => ({}))
        setSubmitError(data.error || 'Tự động nộp bài thất bại')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // 5. Manual submit
  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeAssignment || isSubmitting) return

    setIsSubmitting(true)
    setSubmitSuccess(false)
    setSubmitError('')
    setIsAutoSubmittedDone(false)

    try {
      const type = activeAssignment.type
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: activeAssignment.id,
          studentId: student.id,
          content: submissionText.trim(),
          fileName: uploadedFile?.name || '',
          fileUrl: uploadedFile?.url || '',
          answers: Object.entries(answers).map(([questionId, a]) => ({ questionId, ...a })),
          isAutoSubmitted: false,
        }),
      })

      if (res.ok) {
        // Clear saved timer and active exam session
        localStorage.removeItem(`eduai_quiz_session_${student.studentId}_${activeAssignment.id}`)
        try {
          sessionStorage.removeItem(`eduai_active_exam_${student.studentId}`)
        } catch {}

        setSubmitSuccess(true)
        setSubmitMessage('Chúc mừng em đã hoàn thành và nộp bài thành công!')
        setAnswers({})
        setSubmissionText('')
        setUploadedFile(null)
        setUploadFileError('')
        loadData()
        setTimeout(() => {
          setIsTakingExam(false)
          setActiveTab('results')
          setSubmitSuccess(false)
        }, 1800)
      } else {
        const data = await res.json().catch(() => ({}))
        setSubmitError(data.error || 'Nộp bài thất bại')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const setAnswer = (qid: string, patch: { selectedLabel?: string; text?: string }) =>
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }))

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    window.location.href = '/login'
  }

  // Format seconds into MM:SS (or HH:MM:SS)
  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Calculate answered count for multiple-choice
  const answeredCount = activeAssignment?.questions
    ? activeAssignment.questions.filter((q) => answers[q.id]?.selectedLabel || answers[q.id]?.text).length
    : 0

  // Timer percentage for animated progress bar
  const timerPercentage =
    secondsRemaining !== null && totalTimeSeconds && totalTimeSeconds > 0
      ? Math.max(0, Math.min(100, (secondsRemaining / totalTimeSeconds) * 100))
      : 100

  return (
    <div className="min-h-screen bg-surface-main">
      {/* Student Navigation Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-3.5 bg-surface-card/95 backdrop-blur-md border-b border-border-default shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 flex items-center justify-center shadow-md shadow-primary-500/25">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-text-primary">EduAI • Góc Học Tập</h1>
              <span className="badge badge-primary text-[10px] py-0.5 px-2 font-medium">
                Khối {student.gradeLevel} • Lớp {student.className}
              </span>
            </div>
            <p className="text-[11px] text-text-muted">Môn Tin học Tiểu học</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
              {student.fullName.charAt(0)}
            </div>
            <div className="text-left text-xs">
              <p className="font-semibold text-text-primary">{student.fullName}</p>
              <p className="text-text-dim text-[11px]">
                Lớp {student.className} • {student.studentId}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-surface-main border border-border-default text-text-muted hover:text-danger-400 hover:border-danger-400/40 transition-colors"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-5 animate-fade-in">
        {/* Welcome Banner (when not taking exam) */}
        {!isTakingExam && (
          <div className="glass-card gradient-border p-6 bg-gradient-to-r from-primary-950/30 via-surface-card to-cyan-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="badge badge-primary text-xs mb-2">Học sinh Khối {student.gradeLevel} - Lớp {student.className}</span>
                <h2 className="text-2xl font-bold text-text-primary mb-1">
                  Chào em, <span className="gradient-text">{student.fullName}</span>! 👋
                </h2>
                <p className="text-xs text-text-muted">
                  Dưới đây là danh sách các bài kiểm tra Tin học được giao cho khối mình. Em hãy xem yêu cầu và chọn bài để bắt đầu làm nhé!
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-surface-main/80 border border-border-default text-center">
                  <span className="text-[10px] text-text-dim uppercase font-semibold block">Bài được giao</span>
                  <span className="text-xl font-bold text-primary-400 font-mono">
                    {studentAssignments.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-main/80 border border-border-default text-center">
                  <span className="text-[10px] text-text-dim uppercase font-semibold block">Đã có kết quả</span>
                  <span className="text-xl font-bold text-accent-400 font-mono">
                    {mySubmissions.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Setting Notification Banner */}
        {settingNotice && (
          <div className="p-3 rounded-xl bg-primary-500/15 border border-primary-500/40 text-primary-300 text-xs flex items-center gap-2 animate-scale-in">
            <Sparkles className="w-4 h-4 shrink-0 text-primary-400" />
            <span>{settingNotice}</span>
          </div>
        )}

        {/* Navigation Tabs (Hidden while actively taking exam to focus) */}
        {!isTakingExam && (
          <div className="flex items-center gap-3 border-b border-border-default pb-2">
            <button
              onClick={() => setActiveTab('assignments')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'assignments'
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-card'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Danh sách bài kiểm tra ({studentAssignments.length})
            </button>

            <button
              onClick={() => setActiveTab('results')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'results'
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-card'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-accent-400" />
              Kết quả & Nhận xét AI ({mySubmissions.length})
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: ASSIGNMENT LIST (DEFAULT WHEN STUDENT ENTERS)                    */}
        {/* ========================================================================= */}
        {!isTakingExam && activeTab === 'assignments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
                <span>Các bài kiểm tra Tin học dành cho Khối {student.gradeLevel}</span>
                <span className="badge badge-info text-[10px]">
                  {studentAssignments.length} bài
                </span>
              </h3>
            </div>

            {studentAssignments.length === 0 ? (
              <div className="glass-card p-12 text-center text-text-muted text-xs space-y-2">
                <BookOpen className="w-10 h-10 text-primary-400 mx-auto" />
                <p className="font-semibold text-text-primary text-sm">
                  Chưa có bài kiểm tra nào được giao cho Khối {student.gradeLevel} - Lớp {student.className}
                </p>
                <p>Em hãy kiểm tra lại sau hoặc liên hệ với giáo viên bộ môn nhé.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studentAssignments.map((asg) => {
                  const attempts = getSubmissionsForAssignment(asg.id).length
                  const maxAtt = asg.maxAttempts ?? 0
                  const isLimitReached = maxAtt > 0 && attempts >= maxAtt
                  const latestSub = getSubmissionsForAssignment(asg.id)[0]
                  const hasDoneBefore = attempts > 0

                  return (
                    <div
                      key={asg.id}
                      className="glass-card gradient-border p-5 space-y-4 flex flex-col justify-between hover:shadow-lg transition-all"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="badge badge-info text-[10px]">
                            {TYPE_LABELS[asg.type] || asg.type}
                          </span>
                          <span className="text-[11px] text-text-dim flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-primary-400" />
                            Hạn: {asg.dueDate ? new Date(asg.dueDate).toLocaleDateString('vi-VN') : 'Đang mở'}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-base text-text-primary leading-snug">
                            {asg.title}
                          </h4>
                          {asg.description && (
                            <p className="text-xs text-text-muted mt-1 line-clamp-2 leading-relaxed">
                              {asg.description}
                            </p>
                          )}
                        </div>

                        {/* Rules: Duration & Attempts Badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                          {asg.attachments && asg.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/25 font-medium text-purple-300">
                              <FileText className="w-3.5 h-3.5" />
                              {asg.attachments.length} tệp đính kèm
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-main border border-border-default font-medium text-text-secondary">
                            <Timer className="w-3.5 h-3.5 text-accent-400" />
                            {asg.durationMinutes ? `${asg.durationMinutes} phút (Có đếm ngược)` : 'Không giới hạn thời gian'}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-medium ${
                              isLimitReached
                                ? 'bg-danger-500/10 border-danger-500/30 text-danger-300'
                                : 'bg-surface-main border border-border-default text-text-secondary'
                            }`}
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                            Đã làm: {attempts}/{maxAtt > 0 ? `${maxAtt} lần` : 'Không giới hạn'}
                          </span>
                        </div>

                        {/* Previous Score Display (if student has attempted) */}
                        {hasDoneBefore && latestSub && (
                          <div className="p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-between text-xs">
                            <span className="text-text-muted text-[11px]">Kết quả lần nộp gần nhất:</span>
                            <span className="font-mono font-bold text-accent-400">
                              {latestSub.teacherReview?.finalScore ?? latestSub.aiEvaluation?.score ?? latestSub.quizResult?.score ?? '--'}/10 điểm
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action Button: Bắt đầu làm bài hoặc xem kết quả */}
                      <div className="pt-3 border-t border-border-default/60 flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-accent-400">
                          Thang điểm {asg.maxScore || 10}
                        </span>

                        {isLimitReached ? (
                          <button
                            onClick={() => setActiveTab('results')}
                            className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1 text-accent-300 border-accent-500/30 hover:bg-accent-500/10"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đã hết lượt • Xem kết quả</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartExam(asg)}
                            className="btn-primary text-xs py-2 px-4.5 flex items-center gap-1.5 shadow-md shadow-primary-500/25 font-bold"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{hasDoneBefore ? `Làm lại (Lần ${attempts + 1}/${maxAtt || '∞'})` : 'Bắt đầu làm bài'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: ACTIVE EXAM WORKSPACE (ONLY OPENS WHEN STUDENT CLICKS START)      */}
        {/* ========================================================================= */}
        {isTakingExam && activeAssignment && (
          <div className="space-y-5">
            {/* Back button to safely return */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleExitExam}
                className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 text-text-muted hover:text-text-primary"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại danh sách bài tập</span>
              </button>

              <span className="text-xs text-text-dim">
                Bài thi đang diễn ra • Lần làm thứ <strong>{currentAttempts + 1}</strong>
              </span>
            </div>

            <div className="glass-card gradient-border p-6 md:p-7 space-y-6">
              {/* Top Banner: Assignment Header + Teacher Rules + COUNTDOWN TIMER (ACTIVATED NOW!) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-primary-950/40 via-surface-card to-cyan-950/30 border border-primary-500/30 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge badge-primary text-[10px]">
                        Khối {student.gradeLevel} • Lớp {student.className}
                      </span>
                      <span className="badge badge-info text-[10px]">
                        {TYPE_LABELS[activeAssignment.type] || activeAssignment.type}
                      </span>
                      <span className="badge text-[10px] bg-accent-500/10 border-accent-500/30 text-accent-400 font-mono">
                        Thang điểm {activeAssignment.maxScore || 10}
                      </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-text-primary leading-tight">
                      {activeAssignment.title}
                    </h2>
                    <p className="text-xs text-text-muted flex items-center gap-1.5 pt-0.5">
                      <Clock className="w-3.5 h-3.5 text-primary-400" />
                      Hạn nộp: {activeAssignment.dueDate ? new Date(activeAssignment.dueDate).toLocaleDateString('vi-VN') : 'Đang mở'}
                    </p>
                  </div>

                  {/* COUNTDOWN CLOCK WIDGET (Follows Teacher's Setting) */}
                  <div className="shrink-0 flex flex-col items-center sm:items-end">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-text-dim flex items-center gap-1 mb-1">
                      <Timer className="w-3.5 h-3.5 text-primary-400 animate-spin" />
                      Thời gian làm bài còn lại
                    </div>

                    {secondsRemaining !== null ? (
                      <div
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border font-mono font-black text-2xl md:text-3xl shadow-lg transition-all ${
                          secondsRemaining <= 60
                            ? 'bg-danger-500/20 border-danger-500 text-danger-300 animate-pulse shadow-danger-500/30'
                            : secondsRemaining <= 300
                            ? 'bg-warning-500/20 border-warning-500/70 text-warning-300 shadow-warning-500/20'
                            : 'bg-primary-500/20 border-primary-500/50 text-primary-300 shadow-primary-500/20'
                        }`}
                      >
                        <Timer className={`w-6 h-6 ${secondsRemaining <= 60 ? 'text-danger-400' : 'text-primary-400'}`} />
                        <span>{formatTimer(secondsRemaining)}</span>
                      </div>
                    ) : (
                      <div className="px-4 py-2 rounded-xl bg-accent-500/10 border border-accent-500/30 text-accent-400 font-bold text-sm">
                        ⏱️ Không giới hạn thời gian
                      </div>
                    )}

                    {/* Setting info tags */}
                    <div className="flex items-center gap-3 text-[11px] text-text-dim mt-1.5 font-medium">
                      <span>
                        ⏱️ Quy định:{' '}
                        <strong className="text-accent-400">
                          {activeAssignment.durationMinutes
                            ? `${activeAssignment.durationMinutes} phút`
                            : 'Tự do'}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        🔁 Lần làm:{' '}
                        <strong className="text-primary-300">
                          {currentAttempts + 1}/{maxAttempts > 0 ? maxAttempts : '∞'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar for countdown */}
                {secondsRemaining !== null && (
                  <div className="space-y-1">
                    <div className="w-full h-2 rounded-full bg-surface-main overflow-hidden border border-border-default">
                      <div
                        className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                          secondsRemaining <= 60
                            ? 'bg-danger-500'
                            : secondsRemaining <= 300
                            ? 'bg-warning-500'
                            : 'bg-gradient-to-r from-primary-500 to-accent-400'
                        }`}
                        style={{ width: `${timerPercentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Alert when <= 60 seconds */}
                {secondsRemaining !== null && secondsRemaining <= 60 && !submitSuccess && (
                  <div className="p-3 rounded-xl bg-danger-500/15 border border-danger-500/50 text-danger-300 text-xs flex items-center gap-2 animate-pulse">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-danger-400" />
                    <div>
                      <strong className="font-bold">Sắp hết giờ làm bài! </strong>
                      <span>Khi đồng hồ đếm về 00:00, máy chủ sẽ tự động nộp toàn bộ bài làm hiện tại của em.</span>
                    </div>
                  </div>
                )}
              </div>

              {submitSuccess ? (
                <div className="py-12 text-center space-y-3 animate-scale-in">
                  <CheckCircle2 className="w-16 h-16 text-accent-400 mx-auto" />
                  <h3 className="font-bold text-xl text-text-primary">
                    {isAutoSubmittedDone ? 'Hết giờ - Đã tự động thu bài thành công!' : 'Nộp bài thành công!'}
                  </h3>
                  <p className="text-xs text-text-muted max-w-md mx-auto">{submitMessage}</p>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setIsTakingExam(false)
                        setActiveTab('results')
                      }}
                      className="btn-primary text-xs py-2.5 px-6 inline-flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Xem ngay điểm số & Nhận xét của AI
                    </button>
                  </div>
                </div>
              ) : (
                /* EXAM FORM */
                <form onSubmit={handleSubmitAssignment} className="space-y-6">
                  {/* Assignment Instructions / Description */}
                  {activeAssignment.description && (
                    <div className="p-4 rounded-xl bg-surface-main/80 border border-border-default space-y-1">
                      <span className="text-xs font-bold text-text-secondary flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-primary-400" />
                        Yêu cầu và hướng dẫn của Thầy/Cô:
                      </span>
                      <p className="text-xs text-text-muted leading-relaxed whitespace-pre-line">
                        {activeAssignment.description}
                      </p>
                    </div>
                  )}

                  {/* Teacher's Attached Files */}
                  {activeAssignment.attachments && activeAssignment.attachments.length > 0 && (
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2.5 animate-scale-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-purple-400" />
                          Tài liệu & Đề bài đính kèm của Thầy/Cô ({activeAssignment.attachments.length} tệp):
                        </span>
                        <span className="text-[10px] text-text-dim">Nhấn vào tệp để xem hoặc tải về máy</span>
                      </div>
                      <div className="flex flex-wrap gap-2.5 pt-1">
                        {activeAssignment.attachments.map((f, i) => (
                          <a
                            key={i}
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-card border border-purple-500/30 text-xs font-medium text-purple-200 hover:text-white hover:bg-purple-500/20 hover:border-purple-400 transition-all shadow-sm"
                          >
                            <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="truncate max-w-xs">{f.name}</span>
                            <span className="text-[10px] text-purple-400 font-mono">↗</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION A: Multiple Choice Questions */}
                  {activeAssignment.type === 'multiple_choice' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-border-default/60">
                        <h3 className="font-bold text-sm text-text-primary flex items-center gap-2">
                          <span>Danh sách câu hỏi trắc nghiệm</span>
                          <span className="badge badge-info text-[10px]">
                            {activeAssignment.questions?.length || 0} câu
                          </span>
                        </h3>
                        <span className="text-xs text-text-dim">
                          Đã làm:{' '}
                          <strong className="text-primary-400">
                            {answeredCount}/{activeAssignment.questions?.length || 0}
                          </strong>{' '}
                          câu
                        </span>
                      </div>

                      {(!activeAssignment.questions || activeAssignment.questions.length === 0) && (
                        <div className="p-6 rounded-xl bg-surface-main text-center text-xs text-text-muted">
                          Bài trắc nghiệm chưa có câu hỏi. Vui lòng liên hệ thầy cô.
                        </div>
                      )}

                      {(activeAssignment.questions || []).map((q, qIndex) => {
                        const currentAnswer = answers[q.id]?.selectedLabel
                        return (
                          <div
                            key={q.id}
                            className={`p-4 md:p-5 rounded-2xl border transition-all ${
                              currentAnswer
                                ? 'bg-surface-card border-primary-500/40 shadow-sm'
                                : 'bg-surface-main/80 border-border-default/80 hover:border-primary-500/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-start gap-2.5">
                                <span className="shrink-0 w-6 h-6 rounded-lg bg-primary-500/20 text-primary-300 font-mono font-bold text-xs flex items-center justify-center">
                                  {qIndex + 1}
                                </span>
                                <h4 className="font-bold text-sm text-text-primary leading-relaxed">
                                  {q.content}
                                </h4>
                              </div>
                              <span className="badge text-[10px] shrink-0 font-mono">
                                {q.maxScore || 1} điểm
                              </span>
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                              {(q.options || []).map((opt) => {
                                const isSelected = currentAnswer === opt.label
                                return (
                                  <label
                                    key={opt.label}
                                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                      isSelected
                                        ? 'border-primary-500 bg-primary-500/15 shadow-sm text-text-primary'
                                        : 'border-border-default/70 bg-surface-card hover:bg-surface-card-hover hover:border-primary-500/40 text-text-secondary'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`q-${q.id}`}
                                      checked={isSelected}
                                      onChange={() => setAnswer(q.id, { selectedLabel: opt.label })}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <span className="font-bold text-primary-400 mr-1.5">{opt.label}.</span>
                                      <span>{opt.text}</span>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* SECTION B: Essay Questions */}
                  {activeAssignment.type === 'essay' && (
                    <div className="space-y-4">
                      <div className="pb-2 border-b border-border-default/60">
                        <h3 className="font-bold text-sm text-text-primary">
                          Câu hỏi tự luận (Em hãy nhập câu trả lời vào từng ô bên dưới)
                        </h3>
                      </div>

                      {(activeAssignment.questions || []).map((q, qIndex) => (
                        <div key={q.id} className="p-4 rounded-xl bg-surface-main/60 border border-border-default space-y-2">
                          <p className="text-xs font-bold text-text-primary">
                            Câu {qIndex + 1}: {q.content}
                          </p>
                          <textarea
                            rows={5}
                            required
                            placeholder="Em nhập câu trả lời của mình ở đây..."
                            value={answers[q.id]?.text || ''}
                            onChange={(e) => setAnswer(q.id, { text: e.target.value })}
                            className="input-field text-xs leading-relaxed"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SECTION C: Practice */}
                  {activeAssignment.type === 'practice' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-text-secondary mb-1">
                          Mô tả kết quả thực hành / Lời nhắn cho Thầy Cô:
                        </label>
                        <textarea
                          rows={4}
                          placeholder="Ví dụ: Em đã hoàn thành bài tập 4, gõ đạt 95% độ chính xác, tốc độ 18 WPM..."
                          value={submissionText}
                          onChange={(e) => setSubmissionText(e.target.value)}
                          className="input-field text-xs leading-relaxed"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-text-secondary">
                            Tệp minh chứng đính kèm (Ảnh bài làm, Word, PowerPoint, Scratch .sb3):
                          </label>
                          <span className="text-[10px] text-primary-400 font-medium bg-primary-500/10 px-2 py-0.5 rounded-full border border-primary-500/20">
                            ☁️ Lưu trữ Cloudinary
                          </span>
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx,.pdf,.sb3,.sb2,.txt,.zip"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(file)
                          }}
                        />

                        {uploadedFile ? (
                          <div className="p-4 rounded-xl bg-surface-card border border-primary-500/40 flex items-center justify-between gap-3 animate-scale-in">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center shrink-0 text-primary-400">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="overflow-hidden">
                                <p className="text-xs font-semibold text-text-primary truncate">{uploadedFile.name}</p>
                                <p className="text-[10px] text-text-muted">
                                  {(uploadedFile.size / 1024).toFixed(1)} KB • <span className="text-accent-400 font-semibold">Đã lưu trên Cloudinary</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={uploadedFile.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-surface-main hover:bg-surface-main/80 border border-border-default text-text-secondary text-[11px] font-medium transition-colors"
                              >
                                Xem tệp ↗
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFile(null)
                                  if (fileInputRef.current) fileInputRef.current.value = ''
                                }}
                                className="p-1.5 rounded-lg text-text-muted hover:text-danger-400 hover:bg-danger-500/10 transition-colors"
                                title="Xóa tệp này"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              const file = e.dataTransfer.files?.[0]
                              if (file) handleFileUpload(file)
                            }}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                              isUploadingFile
                                ? 'border-primary-500 bg-primary-500/10'
                                : 'border-border-default hover:border-primary-500/60 bg-surface-main/40 hover:bg-surface-main/70'
                            }`}
                          >
                            {isUploadingFile ? (
                              <div className="py-2 space-y-2">
                                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                <p className="text-xs font-semibold text-primary-400">Đang tải tệp lên Cloudinary...</p>
                                <p className="text-[10px] text-text-muted">Đang phân loại vào thư mục eduai/student/submissions</p>
                              </div>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-primary-400 mx-auto mb-2 animate-bounce-subtle" />
                                <p className="text-xs font-semibold text-text-secondary">
                                  Nhấn để chọn tệp hoặc kéo thả tệp bài làm vào đây
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">
                                  Hỗ trợ: Word (.docx), PowerPoint (.pptx), Ảnh bài làm (.png, .jpg), Scratch (.sb3) — Tối đa 25MB
                                </p>
                              </>
                            )}
                          </div>
                        )}

                        {uploadFileError && (
                          <p className="text-[11px] text-danger-400 mt-1.5">{uploadFileError}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {submitError && (
                    <div className="p-3 rounded-xl bg-danger-500/15 border border-danger-500/40 text-danger-300 text-xs">
                      {submitError}
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="pt-4 border-t border-border-default flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-text-dim">
                      {secondsRemaining !== null && (
                        <span>
                          Đồng hồ đếm ngược: <strong className="text-primary-300">{formatTimer(secondsRemaining)}</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleExitExam}
                        disabled={isSubmitting}
                        className="btn-secondary text-xs py-2.5 px-4 flex-1 sm:flex-initial"
                      >
                        Quay lại
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn-primary text-xs py-2.5 px-6 flex-1 sm:flex-initial flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Đang gửi bài...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Nộp bài ngay
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: MY SUBMISSIONS & AI RESULTS                                      */}
        {/* ========================================================================= */}
        {!isTakingExam && activeTab === 'results' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border-default">
              <h2 className="font-bold text-base text-text-primary flex items-center gap-2">
                <Award className="w-5 h-5 text-accent-400" />
                Lịch sử bài làm & Đánh giá của AI / Thầy Cô ({mySubmissions.length})
              </h2>
              <button
                onClick={() => setActiveTab('assignments')}
                className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1"
              >
                <span>Xem danh sách bài tập</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {mySubmissions.length === 0 ? (
              <div className="glass-card p-10 text-center text-text-muted text-xs space-y-2">
                <Clock className="w-10 h-10 text-text-dim mx-auto" />
                <p className="font-semibold text-text-primary text-sm">Em chưa có bài nộp nào</p>
                <p>Em hãy vào tab "Danh sách bài kiểm tra" để chọn bài và bắt đầu làm nhé!</p>
              </div>
            ) : (
              mySubmissions.map((sub) => {
                const isPublished = sub.status === 'published'
                const quiz = sub.quizResult

                return (
                  <div key={sub.id} className="glass-card gradient-border p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-default/60">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-base text-text-primary">{sub.assignmentTitle}</h3>
                          {sub.attemptNumber && (
                            <span className="badge badge-info text-[10px]">
                              Lần làm thứ {sub.attemptNumber}
                            </span>
                          )}
                          {sub.isAutoSubmitted && (
                            <span className="badge badge-warning text-[10px] flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> Tự động thu bài khi hết giờ
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-dim">
                          Nộp lúc: {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                        </p>
                      </div>

                      {/* Score badge */}
                      {quiz && !isPublished ? (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-text-dim uppercase font-semibold block">
                              Đúng {quiz.correctCount}/{quiz.totalQuestions} câu
                            </span>
                            <span className="text-2xl font-black text-accent-400 font-mono">
                              {quiz.score}/{quiz.maxScore}
                            </span>
                          </div>
                        </div>
                      ) : isPublished ? (
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="badge badge-success text-[10px] mb-0.5 block">Đã công bố</span>
                            <span className="text-2xl font-black text-accent-400 font-mono">
                              {sub.teacherReview?.finalScore ?? sub.aiEvaluation?.score}/10
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="badge badge-warning text-xs flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Đang chờ Thầy Cô duyệt điểm
                        </span>
                      )}
                    </div>

                    {/* Quiz Breakdown: AI general feedback + wrong answer explanation */}
                    {quiz && (
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs space-y-1">
                          <span className="font-bold text-purple-300 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            Nhận xét tổng quát từ Trợ lý AI:
                          </span>
                          <p className="text-text-primary leading-relaxed text-xs">{quiz.studentFeedback}</p>
                        </div>

                        <div className="space-y-2">
                          {quiz.items.map((it: any) => (
                            <div
                              key={it.questionId}
                              className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                                it.isCorrect
                                  ? 'bg-accent-500/5 border-accent-500/30'
                                  : 'bg-danger-500/5 border-danger-500/30'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-text-primary">
                                  Câu {it.index}: {it.content}
                                </p>
                                <span
                                  className={`badge text-[10px] shrink-0 ${
                                    it.isCorrect ? 'badge-success' : 'badge-danger'
                                  }`}
                                >
                                  {it.isCorrect ? 'Đúng' : 'Sai'}
                                </span>
                              </div>

                              <p className="text-text-muted">
                                Em chọn:{' '}
                                <span
                                  className={
                                    it.isCorrect
                                      ? 'text-accent-400 font-semibold'
                                      : 'text-danger-400 font-semibold'
                                  }
                                >
                                  {it.selectedLabel}. {it.selectedText}
                                </span>
                              </p>

                              {!it.isCorrect && (
                                <div className="space-y-1 pt-1 border-t border-border-default/40">
                                  <p className="text-text-muted">
                                    Đáp án đúng:{' '}
                                    <span className="text-accent-400 font-bold">
                                      {it.correctLabel}. {it.correctText}
                                    </span>
                                  </p>
                                  {it.explanation && (
                                    <p className="text-text-secondary leading-relaxed">
                                      <span className="font-bold text-danger-300">Vì sao sai: </span>
                                      {it.explanation}
                                    </p>
                                  )}
                                  {it.hint && (
                                    <p className="text-purple-300 leading-relaxed font-medium">
                                      💡 Gợi ý ôn tập: {it.hint}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Teacher review feedback */}
                    {isPublished && sub.teacherReview && (
                      <div className="p-4 rounded-xl bg-accent-500/10 border border-accent-500/20 space-y-1 text-xs">
                        <span className="font-bold text-accent-300 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-accent-400" />
                          Nhận xét chính thức của Thầy/Cô:
                        </span>
                        <p className="text-text-primary leading-relaxed text-xs">
                          {sub.teacherReview.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </main>
    </div>
  )
}
