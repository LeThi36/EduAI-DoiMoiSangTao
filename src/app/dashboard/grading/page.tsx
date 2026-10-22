'use client'

import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  ClipboardCheck,
  Sparkles,
  CheckCircle2,
  FileText,
  User,
  GraduationCap,
  Save,
  Send,
  AlertCircle,
  FileCode,
  Clock,
  RotateCcw,
  Settings,
  Users,
  Timer,
  Check,
  Download,
  Bot,
  LoaderCircle,
  Search,
  SquareCheck,
  Square,
  WandSparkles,
  ArrowRight,
  Filter,
} from 'lucide-react'

/**
 * Hàm hỗ trợ tổng hợp lời nhận xét hoàn chỉnh và giàu tính sư phạm do AI đề xuất
 */
function buildAISuggestedFeedback(sub?: any): string {
  if (!sub) return ''
  const ai = sub.aiEvaluation
  if (ai) {
    const isZero = Number(ai.score ?? 0) === 0
    const parts: string[] = []

    if (ai.strengths) {
      const s = ai.strengths.trim()
      const isZeroWrong = /(đúng 0|0\/\d+|0 câu|chưa đúng|chưa có câu)/i.test(s)
      if (isZero || isZeroWrong) {
        if (isZeroWrong) {
          parts.push(`📝 Tình trạng: Học sinh chưa có câu trả lời chính xác trong lần làm bài này.`)
        } else {
          parts.push(`🌟 Ghi nhận: ${s}`)
        }
      } else {
        parts.push(`🌟 Điểm tốt: ${s}`)
      }
    }
    if (
      ai.weaknesses &&
      !ai.weaknesses.toLowerCase().includes('không có lỗi') &&
      !ai.weaknesses.toLowerCase().includes('không có sai')
    ) {
      parts.push(`🔍 Cần lưu ý: ${ai.weaknesses.trim()}`)
    } else if (ai.weaknesses && isZero) {
      parts.push(`🔍 Cần lưu ý: ${ai.weaknesses.trim()}`)
    }
    if (ai.suggestions) {
      parts.push(`💡 Lời khuyên: ${ai.suggestions.trim()}`)
    }
    if (parts.length > 0) return parts.join('\n')

    if (isZero) {
      return '⚠️ Học sinh chưa nộp bài hoặc nộp bài trắng khi chưa kịp làm (0 điểm). Em cần liên hệ giáo viên để được hướng dẫn làm lại bài tập.'
    }
  }

  if (sub.quizResult) {
    if (sub.quizResult.studentFeedback) return sub.quizResult.studentFeedback
    if (sub.quizResult.teacherInsight?.summary) return sub.quizResult.teacherInsight.summary
    return `Em đã hoàn thành bài làm trắc nghiệm (${sub.quizResult.correctCount}/${sub.quizResult.totalQuestions} câu đúng). Cố gắng phát huy ở các bài tiếp theo nhé!`
  }

  return ''
}

export default function GradingPage() {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])

  // Selection states
  const [selectedClassId, setSelectedClassId] = useState<string>('c-3-1')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('asg-1')
  const [selectedStudentId, setSelectedStudentId] = useState<string>('st-1')

  // Search in student list
  const [searchQuery, setSearchQuery] = useState('')

  // Batch AI Grading state
  const [batchSize, setBatchSize] = useState<number | 'all'>(5)
  const [selectedStudentIdsForGrading, setSelectedStudentIdsForGrading] = useState<string[]>([])
  const [regrade, setRegrade] = useState(false)
  const [isBatchGrading, setIsBatchGrading] = useState(false)
  const [batchNotice, setBatchNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Teacher Review Form state
  const [finalScore, setFinalScore] = useState<number>(9.5)
  const [teacherFeedback, setTeacherFeedback] = useState<string>('')
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Assignment configuration modal state (duration & attempts)
  const [configAssignment, setConfigAssignment] = useState<any | null>(null)
  const [configMaxAttempts, setConfigMaxAttempts] = useState<number>(1)
  const [configDurationMinutes, setConfigDurationMinutes] = useState<number>(20)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [configSuccess, setConfigSuccess] = useState<string | null>(null)

  // Load initial data
  const loadData = () => {
    fetch('/api/submissions')
      .then((res) => res.json())
      .then((data) => {
        if (data.submissions) setSubmissions(data.submissions)
      })

    fetch('/api/assignments')
      .then((res) => res.json())
      .then((data) => {
        if (data.assignments) {
          setAssignments(data.assignments)
          if (!selectedAssignmentId && data.assignments[0]) {
            setSelectedAssignmentId(data.assignments[0].id)
          }
        }
      })

    fetch('/api/classes')
      .then((res) => res.json())
      .then((data) => {
        if (data.classes) {
          setClasses(data.classes)
          if (!selectedClassId && data.classes[0]) {
            setSelectedClassId(data.classes[0].id)
          }
        }
      })

    fetch('/api/students')
      .then((res) => res.json())
      .then((data) => {
        if (data.students) setStudents(data.students)
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  // Currently selected class object
  const currentClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId) || classes[0]
  }, [classes, selectedClassId])

  // Current assignment object
  const currentAssignment = useMemo(() => {
    return assignments.find((a) => a.id === selectedAssignmentId) || assignments[0]
  }, [assignments, selectedAssignmentId])

  // Students belonging to the selected class
  const classStudents = useMemo(() => {
    if (!currentClass) return []
    return students.filter(
      (s) =>
        s.classId === currentClass.id ||
        s.className === currentClass.name ||
        s.className?.trim() === currentClass.name?.trim()
    )
  }, [students, currentClass])

  // Map each student to their latest submission for the selected assignment
  const studentRows = useMemo(() => {
    if (!currentAssignment || !currentClass) return []

    return classStudents.map((st) => {
      // Find latest submission for this student & assignment
      const studentSubs = submissions.filter(
        (sub) =>
          sub.assignmentId === currentAssignment.id &&
          (sub.studentId === st.id ||
            sub.studentCode === st.studentId ||
            (sub.studentProfileId && (st as any).studentProfileId && sub.studentProfileId === (st as any).studentProfileId))
      )
      studentSubs.sort((a, b) => {
        const attemptDiff = Number(b.attemptNumber || 0) - Number(a.attemptNumber || 0)
        if (attemptDiff !== 0) return attemptDiff
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      })
      const latestSub = studentSubs[0] || null

      return {
        student: st,
        submission: latestSub,
        hasSubmitted: Boolean(latestSub),
        isAIGraded: Boolean(latestSub?.aiEvaluation),
        aiScore: latestSub?.aiEvaluation?.score ?? latestSub?.quizResult?.score,
        teacherScore: latestSub?.teacherReview?.finalScore,
        status: latestSub?.status || 'unsubmitted',
      }
    })
  }, [classStudents, submissions, currentAssignment, currentClass])

  // Filter student rows by search query
  const filteredStudentRows = useMemo(() => {
    if (!searchQuery.trim()) return studentRows
    const q = searchQuery.toLowerCase()
    return studentRows.filter(
      (r) =>
        r.student.fullName?.toLowerCase().includes(q) ||
        r.student.studentId?.toLowerCase().includes(q)
    )
  }, [studentRows, searchQuery])

  // Active selected student & submission
  const activeStudentRow = useMemo(() => {
    return (
      studentRows.find((r) => r.student.id === selectedStudentId) ||
      studentRows[0] ||
      null
    )
  }, [studentRows, selectedStudentId])

  const selectedSubmission = activeStudentRow?.submission || null

  // Lời nhận xét và điểm số do AI đề xuất trước
  const aiSuggestedFeedback = useMemo(() => {
    return buildAISuggestedFeedback(selectedSubmission)
  }, [selectedSubmission])

  const aiSuggestedScore = useMemo(() => {
    return (
      selectedSubmission?.aiEvaluation?.score ??
      selectedSubmission?.quizResult?.score ??
      null
    )
  }, [selectedSubmission])

  // Synchronize review form when active student / submission changes or AI evaluation completes
  useEffect(() => {
    if (selectedSubmission) {
      // 1. Nếu Giáo viên đã từng review và lưu trước đó, ưu tiên hiển thị quyết định của giáo viên
      if (selectedSubmission.teacherReview) {
        setFinalScore(selectedSubmission.teacherReview.finalScore)
        setTeacherFeedback(selectedSubmission.teacherReview.feedback || '')
      } else if (aiSuggestedScore !== null || aiSuggestedFeedback) {
        // 2. Nếu AI đã chấm, tự động nạp đề xuất của AI vào form để giáo viên tiện review và chỉnh sửa
        const score = aiSuggestedScore ?? 0
        setFinalScore(score)
        if (aiSuggestedFeedback) {
          setTeacherFeedback(aiSuggestedFeedback)
        } else if (score === 0) {
          setTeacherFeedback('Học sinh chưa hoàn thành bài tập hoặc nộp bài trắng (0 điểm). Em cần làm lại bài tập.')
        } else {
          setTeacherFeedback('Học sinh đã nộp bài tập.')
        }
      } else {
        // 3. Fallback khi AI chưa chấm
        setFinalScore(0)
        setTeacherFeedback('')
      }
    } else {
      setFinalScore(0)
      setTeacherFeedback('')
    }
  }, [
    selectedSubmission?.id,
    aiSuggestedScore,
    aiSuggestedFeedback,
    selectedSubmission?.teacherReview?.reviewedAt,
  ])

  // Nạp lại nguyên văn gợi ý nhận xét và điểm của AI vào form
  const handleApplyAISuggestion = () => {
    if (aiSuggestedFeedback) {
      setTeacherFeedback(aiSuggestedFeedback)
    }
    if (aiSuggestedScore !== null) {
      setFinalScore(aiSuggestedScore)
    }
  }

  // Thêm nhanh ghi chú sư phạm vào nhận xét
  const handleAppendQuickNote = (note: string) => {
    setTeacherFeedback((prev) => {
      if (!prev.trim()) return note
      return `${prev.trim()}\n${note}`
    })
  }

  // Select student handler
  const handleSelectStudent = (stId: string) => {
    setSelectedStudentId(stId)
  }

  // Toggle specific student checkbox for AI batch grading
  const toggleStudentSelectionForGrading = (stId: string) => {
    setSelectedStudentIdsForGrading((prev) =>
      prev.includes(stId) ? prev.filter((id) => id !== stId) : [...prev, stId]
    )
  }

  // Select all / Deselect all submitted students for AI grading
  const handleSelectAllForGrading = () => {
    const submittedStudentIds = studentRows
      .filter((r) => r.hasSubmitted)
      .map((r) => r.student.id)

    if (selectedStudentIdsForGrading.length === submittedStudentIds.length) {
      setSelectedStudentIdsForGrading([])
    } else {
      setSelectedStudentIdsForGrading(submittedStudentIds)
    }
  }

  // Trigger AI Batch Grading
  const handleRunBatchAIGrading = async () => {
    if (!currentAssignment || !currentClass || isBatchGrading) return

    setIsBatchGrading(true)
    setBatchNotice(null)

    try {
      const payload: any = {
        assignmentId: currentAssignment.id,
        classId: currentClass.id,
        regrade,
      }

      // If specific students are picked, send them; otherwise send batchSize
      if (selectedStudentIdsForGrading.length > 0) {
        payload.studentIds = selectedStudentIdsForGrading
      } else {
        payload.batchSize = batchSize === 'all' ? 50 : Number(batchSize)
      }

      const res = await fetch('/api/grading/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (res.ok) {
        if (data.failed && data.failed.length > 0 && (!data.graded || data.graded.length === 0)) {
          setBatchNotice({
            type: 'error',
            message: `${data.message}. Chi tiết: ${data.failed.map((f: any) => `${f.studentName} (${f.error})`).join('; ')}`,
          })
        } else if (data.failed && data.failed.length > 0) {
          setBatchNotice({
            type: 'error',
            message: `${data.message}. Lỗi: ${data.failed.map((f: any) => `${f.studentName} (${f.error})`).join('; ')}`,
          })
        } else {
          setBatchNotice({
            type: 'success',
            message: `${data.message}${data.remaining > 0 ? ` (Còn ${data.remaining} bài chờ chấm)` : ' • Hoàn tất toàn bộ lớp!'}`,
          })
        }
        loadData()
        setSelectedStudentIdsForGrading([])
      } else {
        setBatchNotice({
          type: 'error',
          message: data.error || 'Có lỗi xảy ra khi gọi AI chấm bài',
        })
      }
    } catch (err: any) {
      setBatchNotice({
        type: 'error',
        message: err.message || 'Lỗi kết nối máy chủ AI',
      })
    } finally {
      setIsBatchGrading(false)
    }
  }

  // Grade single student directly
  const handleGradeSingleSubmission = async (studentId: string) => {
    if (!currentAssignment || !currentClass || isBatchGrading) return
    setIsBatchGrading(true)
    setBatchNotice(null)
    try {
      const res = await fetch('/api/grading/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: currentAssignment.id,
          classId: currentClass.id,
          studentIds: [studentId],
          regrade: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.failed && data.failed.length > 0) {
          setBatchNotice({
            type: 'error',
            message: `Chấm bài thất bại: ${data.failed.map((f: any) => f.error).join('; ')}`,
          })
        } else {
          setBatchNotice({
            type: 'success',
            message: data.message || 'AI đã hoàn thành chấm bài cho học sinh!',
          })
        }
        loadData()
      } else {
        setBatchNotice({
          type: 'error',
          message: data.error || 'Có lỗi xảy ra khi gọi AI chấm bài',
        })
      }
    } catch (err: any) {
      setBatchNotice({
        type: 'error',
        message: err.message || 'Lỗi kết nối máy chủ AI',
      })
    } finally {
      setIsBatchGrading(false)
    }
  }

  // Save teacher review (draft or publish)
  const handleSaveReview = async (publish: boolean) => {
    if (!selectedSubmission) return
    setIsSubmittingReview(true)
    setActionSuccess(null)

    try {
      const res = await fetch(`/api/submissions/${selectedSubmission.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finalScore: Number(finalScore),
          feedback: teacherFeedback,
          isPublished: publish,
        }),
      })

      if (res.ok) {
        setActionSuccess(
          publish
            ? 'Đã công bố điểm chính thức cho học sinh!'
            : 'Đã lưu điểm và nhận xét của giáo viên thành công!'
        )
        loadData()
        setTimeout(() => setActionSuccess(null), 3000)
      } else {
        alert('Không thể lưu kết quả duyệt bài')
      }
    } finally {
      setIsSubmittingReview(false)
    }
  }

  // Open configuration modal for assignment duration & attempts
  const openConfigModal = (asg: any) => {
    setConfigAssignment(asg)
    setConfigMaxAttempts(asg?.maxAttempts ?? 1)
    setConfigDurationMinutes(asg?.durationMinutes ?? 20)
    setConfigSuccess(null)
  }

  const handleSaveAssignmentConfig = async () => {
    if (!configAssignment) return
    setIsSavingConfig(true)
    setConfigSuccess(null)

    try {
      const res = await fetch(`/api/assignments/${configAssignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxAttempts: Number(configMaxAttempts),
          durationMinutes: Number(configDurationMinutes),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setConfigSuccess('Đã lưu cấu hình bài tập thành công!')
        loadData()
        setConfigAssignment(data.assignment)
        setTimeout(() => {
          setConfigSuccess(null)
          setConfigAssignment(null)
        }, 1500)
      } else {
        alert('Không thể lưu cấu hình bài tập')
      }
    } finally {
      setIsSavingConfig(false)
    }
  }

  // Export class evaluation to Excel
  const handleExportExcel = () => {
    if (!currentClass || !currentAssignment) return

    const exportRows = studentRows.map((row, idx) => {
      const sub = row.submission
      const ai = sub?.aiEvaluation
      const quiz = sub?.quizResult

      // Extract rubric criteria score summary
      const rubricDetails = ai?.criteriaScores
        ? ai.criteriaScores.map((c: any) => `${c.criterion}: ${c.score}/${c.maxScore}đ (${c.evidence})`).join('; ')
        : ''

      // AI evaluation details
      const weaknesses = ai?.weaknesses || (quiz ? quiz.teacherInsight?.weakConcepts?.join('; ') || 'Không có' : 'Chưa có đánh giá')
      const strengths = ai?.strengths || (quiz ? quiz.teacherInsight?.masteredConcepts?.join('; ') || 'Không có' : 'Chưa có')
      const suggestions = ai?.suggestions || quiz?.studentFeedback || 'Chưa có'

      return {
        'STT': idx + 1,
        'Mã học sinh': row.student.studentId,
        'Họ và tên': row.student.fullName,
        'Lớp': currentClass.name,
        'Khối': currentClass.gradeId?.replace('g-', '') || currentClass.name.charAt(0),
        'Bài tập': currentAssignment.title,
        'Trạng thái nộp bài': row.hasSubmitted ? 'Đã nộp bài' : 'Chưa nộp bài',
        'Lần làm': sub?.attemptNumber || (row.hasSubmitted ? 1 : 0),
        'Thời gian nộp': sub?.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : '',
        'Điểm AI gợi ý (Thang 10)': row.aiScore !== undefined ? row.aiScore : 'Chưa chấm',
        'Điểm Giáo viên (Thang 10)': row.teacherScore !== undefined ? row.teacherScore : 'Chưa chốt',
        'Học sinh sai gì, yếu gì (AI đánh giá)': weaknesses,
        'Điểm mạnh của học sinh (AI đánh giá)': strengths,
        'Lời khuyên sư phạm / Cần cải thiện (AI)': suggestions,
        'Chi tiết tiêu chí Rubric': rubricDetails,
        'Nhận xét chính thức của Giáo viên': sub?.teacherReview?.feedback || '',
        'Trạng thái công bố': sub?.status === 'published' ? 'Đã công bố' : 'Chưa công bố',
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(exportRows)

    // Set custom column widths
    worksheet['!cols'] = [
      { wch: 6 },  // STT
      { wch: 14 }, // Mã HS
      { wch: 22 }, // Họ tên
      { wch: 10 }, // Lớp
      { wch: 8 },  // Khối
      { wch: 32 }, // Bài tập
      { wch: 16 }, // Trạng thái nộp
      { wch: 10 }, // Lần làm
      { wch: 20 }, // Thời gian nộp
      { wch: 14 }, // Điểm AI
      { wch: 14 }, // Điểm GV
      { wch: 40 }, // Sai gì, yếu gì
      { wch: 35 }, // Điểm mạnh
      { wch: 40 }, // Lời khuyên sư phạm
      { wch: 45 }, // Rubric
      { wch: 35 }, // Nhận xét GV
      { wch: 16 }, // Công bố
    ]

    const workbook = XLSX.utils.book_new()
    const sheetName = `Lop_${currentClass.name.replace('/', '_')}`
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    const dateStr = new Date().toISOString().slice(0, 10)
    const fileName = `Danh_sach_danh_gia_AI_Lop_${currentClass.name.replace('/', '_')}_${dateStr}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  // Quick count metrics for class
  const metrics = useMemo(() => {
    const total = studentRows.length
    const submitted = studentRows.filter((r) => r.hasSubmitted).length
    const aiGraded = studentRows.filter((r) => r.isAIGraded).length
    const pendingAI = submitted - aiGraded
    return { total, submitted, aiGraded, pendingAI }
  }, [studentRows])

  return (
    <div className="space-y-6">
      {/* Page Title & Main Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary-400" />
            Chấm bài & Đánh giá AI theo Lớp
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Chọn lớp để AI chấm bài hàng loạt, kiểm duyệt chi tiết từng học sinh và xuất file Excel đánh giá.
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm bg-gradient-to-r from-accent-600 to-accent-500 hover:from-accent-500 hover:to-accent-400"
            title="Tải về file Excel chứa nhận xét học sinh sai gì, yếu gì, cần cải thiện gì"
          >
            <Download className="w-4 h-4" />
            <span>Xuất file Excel đánh giá</span>
          </button>
        </div>
      </div>

      {/* Selectors Bar: Chọn Lớp & Chọn Bài tập */}
      <div className="glass-card gradient-border p-4 bg-surface-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Class Selector */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-400 shrink-0" />
            <span className="text-xs font-bold text-text-secondary shrink-0">Chọn Lớp:</span>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value)
                setSelectedStudentIdsForGrading([])
              }}
              className="input-field text-xs py-1.5 px-3 font-semibold bg-surface-main min-w-[140px]"
            >
              {classes.length === 0 ? (
                <option value="">Chưa có lớp học</option>
              ) : (
                classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    Lớp {cls.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Assignment Selector */}
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-bold text-text-secondary shrink-0">Chọn Bài tập:</span>
            <select
              value={selectedAssignmentId}
              onChange={(e) => {
                setSelectedAssignmentId(e.target.value)
                setSelectedStudentIdsForGrading([])
              }}
              className="input-field text-xs py-1.5 px-3 font-semibold bg-surface-main max-w-[280px] truncate"
            >
              {assignments.length === 0 ? (
                <option value="">Chưa có bài tập</option>
              ) : (
                assignments.map((asg) => (
                  <option key={asg.id} value={asg.id}>
                    [Khối {asg.gradeLevel}] {asg.title}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Quick summary metrics */}
        <div className="flex items-center gap-3 text-xs">
          <div className="px-3 py-1 rounded-lg bg-surface-main border border-border-default">
            <span className="text-text-dim text-[11px]">Sĩ số: </span>
            <strong className="text-text-primary">{metrics.total} HS</strong>
          </div>
          <div className="px-3 py-1 rounded-lg bg-surface-main border border-border-default">
            <span className="text-text-dim text-[11px]">Đã nộp: </span>
            <strong className="text-accent-400">{metrics.submitted} bài</strong>
          </div>
          <div className="px-3 py-1 rounded-lg bg-surface-main border border-border-default">
            <span className="text-text-dim text-[11px]">AI đã chấm: </span>
            <strong className="text-purple-300">{metrics.aiGraded} bài</strong>
          </div>
        </div>
      </div>

      {/* AI BATCH GRADING CONTROL CARD (Giáo viên dùng AI chấm cho cả lớp hoặc chỉ định học sinh) */}
      <div className="glass-card gradient-border p-4 md:p-5 bg-gradient-to-r from-purple-950/25 via-surface-card to-primary-950/20 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-text-primary">
                  Trợ lý AI Chấm bài Tự động cho Lớp {currentClass?.name}
                </h3>
                <span className="badge badge-info text-[10px]">Google Gemini</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Chấm bài hàng loạt cho cả lớp hoặc theo đợt để giảm tải cho AI. AI sẽ phân tích học sinh sai gì, yếu gì và gợi ý điểm.
              </p>
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRunBatchAIGrading}
              disabled={isBatchGrading || metrics.submitted === 0}
              className="btn-primary text-xs py-2.5 px-5 flex items-center gap-2 shadow-lg shadow-purple-500/20 bg-gradient-to-r from-purple-600 to-primary-600 hover:from-purple-500 hover:to-primary-500 font-bold"
            >
              {isBatchGrading ? (
                <>
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                  <span>Đang phân tích bài làm bằng AI...</span>
                </>
              ) : (
                <>
                  <WandSparkles className="w-4 h-4 text-warning-300" />
                  <span>
                    {selectedStudentIdsForGrading.length > 0
                      ? `AI chấm ${selectedStudentIdsForGrading.length} học sinh đã chọn`
                      : batchSize === 'all'
                        ? `AI chấm toàn bộ lớp (${metrics.pendingAI > 0 ? metrics.pendingAI : metrics.submitted} bài)`
                        : `AI chấm đợt ${batchSize} học sinh`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Batch Grading Settings */}
        <div className="pt-3 border-t border-border-default/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-text-secondary text-[11px]">
              Cấu hình số lượng mỗi lượt:
            </span>
            <div className="flex items-center gap-1.5">
              {[3, 5, 10, 'all'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setBatchSize(val as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${batchSize === val
                    ? 'bg-purple-500 text-white border-purple-500 shadow-sm'
                    : 'bg-surface-main text-text-muted border-border-default hover:text-text-primary'
                    }`}
                >
                  {val === 'all' ? 'Toàn bộ lớp' : `${val} HS/lần`}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer ml-2 text-text-muted hover:text-text-primary text-[11px]">
              <input
                type="checkbox"
                checked={regrade}
                onChange={(e) => setRegrade(e.target.checked)}
                className="rounded"
              />
              <span>Chấm lại cả bài đã có điểm AI</span>
            </label>
          </div>

          {selectedStudentIdsForGrading.length > 0 && (
            <div className="inline-flex items-center gap-1.5 text-xs text-purple-300 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/30">
              <SquareCheck className="w-3.5 h-3.5" />
              <span>Đang chỉ định {selectedStudentIdsForGrading.length} học sinh được chọn</span>
              <button
                onClick={() => setSelectedStudentIdsForGrading([])}
                className="text-[10px] text-danger-300 ml-1 underline hover:text-danger-200"
              >
                Bỏ chọn
              </button>
            </div>
          )}
        </div>

        {/* Batch Result Notice */}
        {batchNotice && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-scale-in ${batchNotice.type === 'success'
              ? 'bg-accent-500/15 border-accent-500/40 text-accent-300'
              : 'bg-danger-500/15 border-danger-500/40 text-danger-300'
              }`}
          >
            <div className="flex items-center gap-2">
              {batchNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-accent-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-danger-400" />
              )}
              <span>{batchNotice.message}</span>
            </div>
            <button
              onClick={() => setBatchNotice(null)}
              className="text-text-dim hover:text-text-primary text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/30 text-accent-300 text-xs flex items-center gap-2 animate-scale-in">
          <CheckCircle2 className="w-4 h-4 text-accent-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main 2-Column Cockpit */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student List of Selected Class (4.5 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary-400" />
              Danh sách học sinh ({studentRows.length})
            </h2>

            <button
              onClick={handleSelectAllForGrading}
              className="text-[11px] text-primary-300 hover:text-primary-200 flex items-center gap-1 font-semibold"
              title="Chọn hoặc bỏ chọn tất cả học sinh đã nộp bài để AI chấm"
            >
              <SquareCheck className="w-3.5 h-3.5" />
              <span>
                {selectedStudentIdsForGrading.length > 0 ? 'Bỏ chọn' : 'Chọn nộp bài'}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã HS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field text-xs py-2 pl-8 pr-3"
            />
          </div>

          {/* Student Cards List */}
          <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
            {filteredStudentRows.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface-card border border-border-default text-center text-xs text-text-dim italic">
                {currentClass
                  ? `Không tìm thấy học sinh nào trong lớp ${currentClass.name}`
                  : 'Chưa có lớp học nào'}
              </div>
            ) : (
              filteredStudentRows.map((row) => {
                const st = row.student
                const sub = row.submission
                const isSelected = selectedStudentId === st.id
                const isCheckedForGrading = selectedStudentIdsForGrading.includes(st.id)

                return (
                  <div
                    key={st.id}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${isSelected
                      ? 'bg-primary-500/15 border-primary-500 shadow-md shadow-primary-500/15'
                      : 'bg-surface-card hover:bg-surface-card-hover border-border-default/70 hover:border-primary-500/40'
                      }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Checkbox for batch AI grading */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleStudentSelectionForGrading(st.id)
                        }}
                        disabled={!row.hasSubmitted}
                        className={`mt-0.5 shrink-0 ${!row.hasSubmitted ? 'opacity-30 cursor-not-allowed' : ''}`}
                        title={row.hasSubmitted ? 'Tích chọn để chỉ định AI chấm học sinh này' : 'Học sinh chưa nộp bài'}
                      >
                        {isCheckedForGrading ? (
                          <SquareCheck className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Square className="w-4 h-4 text-text-dim hover:text-text-primary" />
                        )}
                      </button>

                      {/* Student info & click to view detail */}
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => handleSelectStudent(st.id)}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <div className="truncate">
                            <h4 className="font-bold text-xs text-text-primary truncate">
                              {st.fullName}
                            </h4>
                            <p className="text-[10px] text-text-dim">
                              {st.studentId} • Lớp {st.className}
                            </p>
                          </div>

                          {/* Submission & Grading Badges */}
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            {row.hasSubmitted ? (
                              row.isAIGraded ? (
                                <span className="font-mono font-bold text-purple-300 text-[11px] flex items-center gap-1 bg-purple-500/15 px-1.5 py-0.5 rounded border border-purple-500/30">
                                  <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                                  AI: {row.aiScore}/10
                                </span>
                              ) : (
                                <span className="badge badge-warning text-[9px] py-0.5 px-1.5">
                                  Chờ AI chấm
                                </span>
                              )
                            ) : (
                              <span className="badge text-[9px] py-0.5 px-1.5 bg-surface-main text-text-dim border border-border-default">
                                Chưa nộp bài
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Submission Time & Teacher review status */}
                        {sub && (
                          <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-border-default/40 text-text-dim">
                            <span className="truncate">
                              Nộp: {new Date(sub.submittedAt).toLocaleDateString('vi-VN')}
                              {sub.attemptNumber && ` • Lần ${sub.attemptNumber}`}
                            </span>
                            {sub.teacherReview?.finalScore !== undefined && (
                              <span className="font-mono font-bold text-accent-400">
                                GV: {sub.teacherReview.finalScore}/10
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Inspection Cockpit (7.5 cols - y hệt ảnh người dùng gửi) */}
        <div className="lg:col-span-8">
          {activeStudentRow ? (
            selectedSubmission ? (
              <div className="glass-card gradient-border p-6 space-y-6">
                {/* 1. Header Info (Badge Lớp, Tên học sinh, Tên bài tập, Điểm AI & Điểm Giáo viên) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-default">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="badge badge-primary text-xs">
                        Lớp {selectedSubmission.className}
                      </span>
                      {selectedSubmission.attemptNumber && (
                        <span className="badge badge-info text-xs">
                          Lượt làm thứ {selectedSubmission.attemptNumber}
                        </span>
                      )}
                      {selectedSubmission.isAutoSubmitted && (
                        <span className="badge badge-warning text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Tự động thu bài khi hết giờ
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-text-primary">
                      {selectedSubmission.studentName}
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Bài tập: <span className="text-text-primary font-semibold">{selectedSubmission.assignmentTitle}</span>
                    </p>
                  </div>

                  {/* Top Score Cards (Tím: Điểm AI, Xanh: Điểm Giáo viên) */}
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center min-w-[90px]">
                      <span className="text-[10px] text-purple-300 uppercase block font-semibold">
                        Điểm AI gợi ý
                      </span>
                      <span className="text-xl font-black text-purple-300 font-mono">
                        {selectedSubmission.aiEvaluation?.score ?? selectedSubmission.quizResult?.score ?? '--'}/10
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/20 text-center min-w-[90px]">
                      <span className="text-[10px] text-accent-300 uppercase block font-semibold">
                        Điểm Giáo viên
                      </span>
                      <span className="text-xl font-black text-accent-400 font-mono">
                        {finalScore}/10
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. BÀI NỘP GỐC CỦA HỌC SINH */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    BÀI NỘP GỐC CỦA HỌC SINH:
                  </h3>
                  <div className="p-4 rounded-xl bg-surface-main/80 border border-border-default space-y-3 text-xs">
                    <div>
                      <span className="text-[11px] font-semibold text-text-dim block mb-1">
                        💬 Lời nhắn / Mô tả bài làm của học sinh:
                      </span>
                      <div className="p-3 rounded-lg bg-surface-card border border-border-default/60 text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
                        {selectedSubmission.content ? (
                          <span>{selectedSubmission.content}</span>
                        ) : (
                          <span className="text-text-dim italic">(Học sinh không để lại lời nhắn kèm theo)</span>
                        )}
                      </div>
                    </div>

                    {/* Tệp minh chứng do học sinh nộp */}
                    {selectedSubmission.fileName && (
                      <div>
                        <span className="text-[11px] font-semibold text-text-dim block mb-1">
                          📎 Tệp sản phẩm học sinh nộp:
                        </span>
                        {selectedSubmission.fileUrl ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <a
                                href={selectedSubmission.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-500/15 hover:bg-primary-500/25 border border-primary-500/30 text-primary-300 text-xs font-semibold transition-colors shadow-sm"
                              >
                                <FileCode className="w-4 h-4 text-primary-400 shrink-0" />
                                <span className="truncate max-w-xs">{selectedSubmission.fileName}</span>
                                <span className="text-[10px] text-primary-400 font-mono">↗</span>
                              </a>
                            </div>
                            {/\.(png|jpe?g|webp|gif)$/i.test(selectedSubmission.fileName) && (
                              <div className="mt-1 w-full max-w-sm rounded-lg overflow-hidden border border-border-default/60">
                                <img
                                  src={selectedSubmission.fileUrl}
                                  alt="Minh chứng bài làm"
                                  className="w-full h-auto object-cover max-h-48 cursor-pointer hover:opacity-95 transition-opacity"
                                  onClick={() => window.open(selectedSubmission.fileUrl, '_blank')}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 p-2 rounded-lg bg-surface-card border border-border-default/60 text-primary-300 text-xs">
                            <FileCode className="w-4 h-4" />
                            <span>{selectedSubmission.fileName}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tệp đề bài mẫu đính kèm của giáo viên (nếu có) */}
                    {currentAssignment?.attachments && currentAssignment.attachments.length > 0 && (
                      <div className="pt-2 border-t border-border-default/60">
                        <span className="text-[11px] font-semibold text-text-dim block mb-1">
                          📁 Tệp tài liệu đề bài giáo viên giao ({currentAssignment.attachments.length} tệp):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {currentAssignment.attachments.map((f: any, i: number) => (
                            <a
                              key={i}
                              href={f.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs hover:bg-purple-500/20 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{f.name}</span>
                              <span className="text-[10px] text-purple-400 font-mono">↗</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. ĐÁNH GIÁ CHI TIẾT TỪ AI (GOOGLE GEMINI) */}
                {selectedSubmission.aiEvaluation ? (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      ĐÁNH GIÁ CHI TIẾT TỪ AI (GOOGLE GEMINI):
                    </h3>

                    {/* 3 Blocks: Điểm mạnh, Cần cải thiện (sai gì, yếu gì), Lời khuyên sư phạm */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* Điểm mạnh */}
                      <div className="p-3.5 rounded-xl bg-accent-500/10 border border-accent-500/20 space-y-1">
                        <span className="font-semibold text-accent-400 block">
                          {selectedSubmission.aiEvaluation.strengths ? '🌟 Điểm mạnh' : '📝 Điểm mạnh'}
                        </span>
                        <p className="text-text-muted text-[11px] leading-relaxed">
                          {selectedSubmission.aiEvaluation.strengths || (
                            Number(selectedSubmission.aiEvaluation.score ?? 0) === 0
                              ? 'Không có (bài làm chưa đạt yêu cầu để ghi nhận điểm mạnh).'
                              : 'Không ghi nhận thêm điểm mạnh đặc biệt.'
                          )}
                        </p>
                      </div>

                      {/* Cần cải thiện (Học sinh sai gì, yếu gì) */}
                      <div className="p-3.5 rounded-xl bg-warning-500/10 border border-warning-500/20 space-y-1">
                        <span className="font-semibold text-warning-400 block">🔍 Cần cải thiện</span>
                        <p className="text-text-muted text-[11px] leading-relaxed">
                          {selectedSubmission.aiEvaluation.weaknesses || (
                            Number(selectedSubmission.aiEvaluation.score ?? 0) >= 9
                              ? 'Không có lỗi sai (bài làm hoàn thành xuất sắc).'
                              : 'Không có lỗi sai nghiêm trọng.'
                          )}
                        </p>
                      </div>

                      {/* Lời khuyên sư phạm */}
                      <div className="p-3.5 rounded-xl bg-primary-500/10 border border-primary-500/20 space-y-1">
                        <span className="font-semibold text-primary-400 block">💡 Lời khuyên sư phạm</span>
                        <p className="text-text-muted text-[11px] leading-relaxed">
                          {selectedSubmission.aiEvaluation.suggestions || (
                            Number(selectedSubmission.aiEvaluation.score ?? 0) === 0
                              ? 'Em cần xem lại lý thuyết, chú ý làm cẩn thận và nộp lại bài tập nhé.'
                              : 'Tiếp tục rèn luyện và phát huy.'
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Căn cứ chấm điểm theo từng tiêu chí Rubric */}
                    {selectedSubmission.aiEvaluation.criteriaScores && (
                      <div className="p-4 rounded-xl bg-surface-main/60 border border-border-default/50 space-y-2">
                        <span className="text-[11px] font-semibold text-text-dim block">
                          Căn cứ chấm điểm theo từng tiêu chí Rubric:
                        </span>
                        <div className="space-y-1.5">
                          {selectedSubmission.aiEvaluation.criteriaScores.map((c: any, i: number) => (
                            <div
                              key={i}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-lg bg-surface-card text-xs border border-border-default/40"
                            >
                              <div>
                                <span className="font-semibold text-text-secondary">{c.criterion}:</span>
                                <span className="text-text-dim ml-1.5 text-[11px]">{c.evidence}</span>
                              </div>
                              <span className="font-mono font-bold text-accent-400 text-xs shrink-0 self-end sm:self-auto">
                                {c.score}/{c.maxScore} điểm
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : selectedSubmission.quizResult ? (
                  /* Quiz Analysis */
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Phân tích bài trắc nghiệm ({selectedSubmission.quizResult.correctCount}/
                      {selectedSubmission.quizResult.totalQuestions} câu đúng)
                    </h3>
                    <div className="p-3.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs space-y-2">
                      <p className="text-text-primary leading-relaxed">
                        {selectedSubmission.quizResult.teacherInsight?.summary}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Waiting for AI evaluation or AI error state */
                  <div className="space-y-3">
                    {selectedSubmission.aiError && (
                      <div className="p-3.5 rounded-xl bg-danger-500/10 border border-danger-500/30 text-xs flex items-start gap-2.5 text-danger-300">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-danger-400" />
                        <div className="space-y-1 flex-1">
                          <p className="font-semibold text-danger-200">AI chấm gặp sự cố:</p>
                          <p className="text-[11px] text-text-muted break-all">{selectedSubmission.aiError}</p>
                          <button
                            onClick={() => handleGradeSingleSubmission(selectedSubmission.studentId)}
                            disabled={isBatchGrading}
                            className="text-xs text-primary-400 hover:underline inline-flex items-center gap-1 mt-1 font-medium"
                          >
                            <RotateCcw className="w-3 h-3" /> Thử chấm lại bài này
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="p-6 rounded-xl bg-surface-main/60 border border-dashed border-border-default text-center space-y-3">
                      <Bot className="w-8 h-8 text-purple-400 mx-auto opacity-70" />
                      <div>
                        <h4 className="font-bold text-xs text-text-primary">Bài nộp này chưa được AI chấm</h4>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Cô giáo có thể bấm nút dưới đây để AI phân tích và chấm điểm chi tiết bài làm này ngay.
                        </p>
                      </div>
                      <button
                        onClick={() => handleGradeSingleSubmission(selectedSubmission.studentId)}
                        disabled={isBatchGrading}
                        className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-primary-600 hover:from-purple-500 hover:to-primary-500 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isBatchGrading ? 'AI đang phân tích và chấm bài...' : 'AI chấm riêng bài này ngay'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 5. QUY TRÌNH DUYỆT ĐÁNH GIÁ: AI ĐỀ XUẤT TRƯỚC ➔ GIÁO VIÊN REVIEW & CHỐT */}
                <div className="space-y-4 pt-4 border-t border-border-default">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <GraduationCap className="w-4 h-4 text-primary-400" />
                        Quy trình Đánh giá: AI đề xuất
                      </h3>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        AI sẽ phân tích bài làm và đưa ra lời nhận xét trước. Thầy/Cô kiểm tra lại, điều chỉnh (nếu cần) trước khi công bố cho học sinh.
                      </p>
                    </div>

                    {selectedSubmission.teacherReview?.isPublished ? (
                      <span className="badge badge-success text-[11px] self-start sm:self-auto flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã công bố kết quả
                      </span>
                    ) : selectedSubmission.teacherReview ? (
                      <span className="badge badge-warning text-[11px] self-start sm:self-auto flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Đang lưu bản nháp
                      </span>
                    ) : null}
                  </div>

                  {/* BƯỚC 1: LỜI NHẬN XÉT DO AI ĐỀ XUẤT TRƯỚC */}
                  {selectedSubmission.aiEvaluation || selectedSubmission.quizResult ? (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 via-surface-main/80 to-primary-500/10 border border-purple-500/30 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold text-[11px] border border-purple-500/30">
                            <Bot className="w-3.5 h-3.5 text-purple-400" />
                            Bước 1: Lời nhận xét do AI đề xuất trước
                          </span>
                          {aiSuggestedScore !== null && (
                            <span className="text-xs font-mono font-bold text-purple-300">
                              (Điểm gợi ý: {aiSuggestedScore}/10)
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleApplyAISuggestion}
                          className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 transition-colors shadow-sm"
                          title="Chép lại toàn bộ nhận xét và điểm của AI vào ô duyệt bên dưới"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Nạp lại gợi ý của AI vào ô duyệt
                        </button>
                      </div>

                      <div className="p-3 rounded-lg bg-surface-card/90 border border-border-default/60 text-xs text-text-primary whitespace-pre-line leading-relaxed font-sans shadow-inner">
                        {aiSuggestedFeedback || (aiSuggestedScore === 0 ? '⚠️ Học sinh chưa nộp bài hoặc nộp bài trắng (0 điểm). Cần làm lại bài tập.' : 'AI đã phân tích bài tập và đề xuất điểm số.')}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-dashed border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <Bot className="w-5 h-5 text-purple-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-text-primary">
                            Bài làm này chưa có lời nhận xét từ AI
                          </p>
                          <p className="text-[11px] text-text-muted">
                            Bấm nút bên cạnh để AI đọc bài làm, chấm điểm và tạo nhận xét gợi ý ngay lập tức.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleGradeSingleSubmission(selectedSubmission.studentId)}
                        disabled={isBatchGrading}
                        className="btn-primary text-xs py-1.5 px-3.5 inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-primary-600 shrink-0 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isBatchGrading ? 'AI đang phân tích...' : '✨ AI chấm & gợi ý nhận xét ngay'}
                      </button>
                    </div>
                  )}

                  {/* BƯỚC 2: GIÁO VIÊN XEM XÉT (REVIEW) VÀ CHỐT KẾT QUẢ */}
                  <div className="p-4 rounded-xl bg-surface-main/60 border border-border-default space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-500/20 text-primary-300 font-semibold text-[11px] border border-primary-500/30">
                          <GraduationCap className="w-3.5 h-3.5 text-primary-400" />
                          Bước 2: Giáo viên Review & Chốt quyết định chính thức
                        </span>
                        {teacherFeedback && teacherFeedback === aiSuggestedFeedback ? (
                          <span className="text-[10px] text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/25">
                            🤖 Đang áp dụng gợi ý AI
                          </span>
                        ) : teacherFeedback ? (
                          <span className="text-[10px] text-warning-300 bg-warning-500/15 px-2 py-0.5 rounded border border-warning-500/25">
                            ✏️ Đã được Thầy/Cô chỉnh sửa
                          </span>
                        ) : null}
                      </div>

                      {/* Quick Note Chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-text-dim">Chèn nhanh:</span>
                        <button
                          type="button"
                          onClick={() => handleAppendQuickNote('👏 Em làm bài rất tốt, tiếp tục phát huy nhé!')}
                          className="text-[10px] px-2 py-0.5 rounded bg-surface-card hover:bg-surface-card-hover border border-border-default text-text-secondary hover:text-primary-300 transition-colors"
                        >
                          + Khen ngợi
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendQuickNote('💡 Cần chú ý đọc kỹ yêu cầu đề bài hơn ở bài sau nhé!')}
                          className="text-[10px] px-2 py-0.5 rounded bg-surface-card hover:bg-surface-card-hover border border-border-default text-text-secondary hover:text-primary-300 transition-colors"
                        >
                          + Cần cẩn thận
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendQuickNote('🎨 Bài làm sáng tạo, thẩm mỹ và màu sắc hài hòa!')}
                          className="text-[10px] px-2 py-0.5 rounded bg-surface-card hover:bg-surface-card-hover border border-border-default text-text-secondary hover:text-primary-300 transition-colors"
                        >
                          + Sáng tạo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendQuickNote('⚠️ Em chưa hoàn thành bài tập hoặc nộp bài trắng. Em cần liên hệ Thầy/Cô để được hướng dẫn làm lại nhé!')}
                          className="text-[10px] px-2 py-0.5 rounded bg-surface-card hover:bg-surface-card-hover border border-border-default text-text-secondary hover:text-danger-300 transition-colors"
                        >
                          + Chưa nộp bài
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1">
                          Điểm chốt (Thang 10) *
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="10"
                          value={finalScore}
                          onChange={(e) => setFinalScore(Number(e.target.value))}
                          className="input-field text-base font-bold font-mono text-accent-400"
                        />
                        {aiSuggestedScore !== null && (
                          <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
                            <span>Gợi ý AI: <strong className="text-purple-400">{aiSuggestedScore}</strong></span>
                            {finalScore !== aiSuggestedScore && (
                              <button
                                type="button"
                                onClick={() => setFinalScore(aiSuggestedScore)}
                                className="text-[10px] text-primary-400 hover:underline"
                              >
                                Dùng điểm AI
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-text-secondary mb-1">
                          Lời nhận xét chính thức cho học sinh (Thầy/Cô có thể sửa tự do):
                        </label>
                        <textarea
                          rows={4}
                          value={teacherFeedback}
                          onChange={(e) => setTeacherFeedback(e.target.value)}
                          className="input-field text-xs leading-relaxed"
                          placeholder="Thầy/Cô đọc lại gợi ý của AI ở trên và điều chỉnh tại đây nếu cần..."
                        />
                        <div className="flex items-center justify-between mt-1 text-[11px] text-text-dim">
                          <span>Nội dung này sẽ được gửi trực tiếp đến trang cá nhân của học sinh.</span>
                          <span>{teacherFeedback.length} ký tự</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-default/50">
                      {actionSuccess ? (
                        <span className="text-xs text-accent-400 font-medium flex items-center gap-1.5 animate-fade-in">
                          <CheckCircle2 className="w-4 h-4 text-accent-400" /> {actionSuccess}
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-dim">
                          Lưu bản nháp để xem lại sau, hoặc công bố ngay để phụ huynh & học sinh xem được.
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveReview(false)}
                          disabled={isSubmittingReview}
                          className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Lưu bản nháp duyệt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveReview(true)}
                          disabled={isSubmittingReview}
                          className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow-md shadow-primary-500/20"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Công bố kết quả cho học sinh
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Student hasn't submitted */
              <div className="glass-card gradient-border p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-main flex items-center justify-center mx-auto text-text-dim border border-border-default">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-text-primary">
                  {activeStudentRow.student.fullName} ({activeStudentRow.student.studentId})
                </h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  Học sinh này chưa nộp bài cho bài tập <strong className="text-text-primary">"{currentAssignment?.title}"</strong>.
                </p>
              </div>
            )
          ) : (
            <div className="glass-card p-12 text-center text-text-dim text-xs">
              Vui lòng chọn một học sinh trong danh sách bên trái để bắt đầu kiểm duyệt.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Cài đặt quy định làm bài (Thời gian & Số lần làm) */}
      {configAssignment && (
        <div className="modal-overlay">
          <div className="modal-content max-w-md animate-scale-in">
            <div className="pb-3 border-b border-border-default flex items-center justify-between">
              <div>
                <span className="badge badge-primary text-[10px] mb-1">Cài đặt quy định làm bài</span>
                <h3 className="font-bold text-sm text-text-primary line-clamp-1">
                  {configAssignment.title}
                </h3>
              </div>
              <button
                onClick={() => setConfigAssignment(null)}
                className="text-text-dim hover:text-text-primary text-base"
              >
                ✕
              </button>
            </div>

            {configSuccess ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-accent-400 mx-auto" />
                <p className="font-bold text-sm text-text-primary">{configSuccess}</p>
              </div>
            ) : (
              <div className="space-y-4 mt-4 text-xs">
                <div>
                  <label className="block font-semibold text-text-secondary mb-1">
                    Chọn bài tập để cấu hình:
                  </label>
                  <select
                    value={configAssignment.id}
                    onChange={(e) => {
                      const found = assignments.find((a) => a.id === e.target.value)
                      if (found) openConfigModal(found)
                    }}
                    className="input-field text-xs py-2"
                  >
                    {assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        [Khối {a.gradeLevel}] {a.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-text-secondary mb-1">
                      ⏱️ Thời gian làm bài (Phút):
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0 = Không giới hạn"
                      value={configDurationMinutes}
                      onChange={(e) => setConfigDurationMinutes(Math.max(0, Number(e.target.value)))}
                      className="input-field text-xs font-mono font-bold"
                    />
                    <p className="text-[10px] text-text-dim mt-1">
                      {configDurationMinutes > 0
                        ? `Đồng hồ server đếm ngược ${configDurationMinutes} phút.`
                        : 'Không giới hạn thời gian.'}
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold text-text-secondary mb-1">
                      🔁 Số lần làm tối đa:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0 = Không giới hạn"
                      value={configMaxAttempts}
                      onChange={(e) => setConfigMaxAttempts(Math.max(0, Number(e.target.value)))}
                      className="input-field text-xs font-mono font-bold"
                    />
                    <p className="text-[10px] text-text-dim mt-1">
                      {configMaxAttempts > 0
                        ? `Làm tối đa ${configMaxAttempts} lần.`
                        : 'Không giới hạn.'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
                  <button
                    type="button"
                    onClick={() => setConfigAssignment(null)}
                    className="btn-secondary text-xs"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAssignmentConfig}
                    disabled={isSavingConfig}
                    className="btn-primary text-xs flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    {isSavingConfig ? 'Đang lưu...' : 'Lưu cấu hình'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
