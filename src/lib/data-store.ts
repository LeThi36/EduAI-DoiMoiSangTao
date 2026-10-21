// Global in-memory / state repository with realistic seed data
// Conforming to the schema defined in context.md and schema.prisma

export interface SchoolYearItem {
  id: string
  name: string
  startYear: number
  endYear: number
  isActive: boolean
  isArchived: boolean
}

export interface GradeItem {
  id: string
  level: number
  name: string
}

export interface ClassItem {
  id: string
  name: string
  code: string
  schoolYearId: string
  gradeId: string
  teacherId: string
  teacherName: string
  studentCount: number
  isActive: boolean
  isArchived: boolean
}

export interface StudentItem {
  id: string
  studentId: string // Mã học sinh duy nhất
  username?: string // Tên đăng nhập do giáo viên cấp
  fullName: string
  classId: string
  className: string
  gradeLevel: number
  schoolYearId: string
  email: string
  passwordHash?: string // Mật khẩu băm an toàn (PBKDF2-SHA256)
  initialPassword?: string // Mật khẩu ban đầu để giáo viên xem/in danh sách cấp cho học sinh
  status: 'active' | 'transferred'
}

export interface AssignmentItem {
  id: string
  title: string
  description: string
  type: 'multiple_choice' | 'essay' | 'practice'
  gradeLevel: number
  targetClassIds: string[]
  maxScore: number
  startDate: string
  dueDate: string
  isPublished: boolean
  rubric: {
    criteria: { name: string; maxScore: number; description: string }[]
  }
  aiPrompt: string
  teacherId?: string
  maxAttempts?: number // Số lần làm tối đa (0 hoặc undefined = không giới hạn)
  durationMinutes?: number // Thời gian làm bài tính bằng phút (0 hoặc undefined = không giới hạn)
  attachments?: {
    name: string
    url: string
    mimeType: string
    size: number
  }[]
  questions?: {
    id: string
    content: string
    type: 'single_choice' | 'essay' | 'practice'
    options?: { label: string; text: string; isCorrect: boolean }[]
    correctAnswer?: string
    maxScore: number
  }[]
}

export interface QuizItemResult {
  questionId: string
  index: number
  content: string
  selectedLabel?: string
  selectedText?: string
  correctLabel?: string
  correctText?: string
  isCorrect: boolean
  score: number
  maxScore: number
  /** AI: why the chosen answer is wrong + hint (only for wrong items) */
  explanation?: string
  hint?: string
}

export interface QuizResult {
  correctCount: number
  totalQuestions: number
  score: number
  maxScore: number
  items: QuizItemResult[]
  /** AI: encouraging overall comment for the student */
  studentFeedback: string
  /** AI: analysis for the teacher */
  teacherInsight: {
    summary: string
    masteredConcepts: string[]
    weakConcepts: string[]
    misconceptions: string[]
    recommendation: string
  }
  aiGenerated: boolean
}

export interface SubmissionItem {
  id: string
  assignmentId: string
  assignmentTitle: string
  studentId: string
  studentProfileId?: string
  studentName: string
  studentCode: string
  classId?: string
  className: string
  status: 'draft' | 'submitted' | 'grading' | 'reviewed' | 'published'
  submittedAt: string
  content?: string
  fileUrl?: string
  fileName?: string
  attemptNumber?: number
  isAutoSubmitted?: boolean
  /** Thời điểm AI chấm xong (chấm hàng loạt theo lớp do giáo viên kích hoạt) */
  aiGradedAt?: string
  /** Lỗi gần nhất khi AI chấm (nếu có) */
  aiError?: string
  answers?: {
    questionId: string
    selectedLabel?: string
    text?: string
    isCorrect?: boolean
  }[]
  quizResult?: QuizResult
  aiEvaluation?: {
    score: number
    strengths: string
    weaknesses: string
    suggestions: string
    criteriaScores: { criterion: string; score: number; maxScore: number; evidence: string }[]
  }
  teacherReview?: {
    finalScore: number
    feedback: string
    reviewedAt: string
    isPublished: boolean
  }
}


