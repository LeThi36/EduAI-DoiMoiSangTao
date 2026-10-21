'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import {
  BookOpen,
  Plus,
  Calendar,
  Sparkles,
  Users,
  CheckCircle2,
  FileText,
  Layers,
  X,
  ArrowRight,
  FileUp,
  Download,
  ListPlus,
  Trash2,
  Pencil,
} from 'lucide-react'

type QuestionDraft = {
  content: string
  options: { text: string; isCorrect: boolean }[]
  maxScore: number
}

type Attachment = {
  name: string
  url: string
  mimeType: string
  size: number
}

const createQuestion = (): QuestionDraft => ({
  content: '',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
  maxScore: 1,
})

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null)

  // Form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('practice')
  const [gradeLevel, setGradeLevel] = useState(3)
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([])
  const [aiPrompt, setAiPrompt] = useState('')
  const [questions, setQuestions] = useState<QuestionDraft[]>([createQuestion()])
  const [essayQuestion, setEssayQuestion] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [questionImportError, setQuestionImportError] = useState('')
  const [durationMinutes, setDurationMinutes] = useState<number>(20)
  const [maxAttempts, setMaxAttempts] = useState<number>(1)

  const loadAssignments = () => {
    fetch('/api/assignments')
      .then((res) => res.json())
      .then((data) => {
        if (data.assignments) setAssignments(data.assignments)
      })
  }

  useEffect(() => {
    loadAssignments()
    fetch('/api/classes')
      .then((res) => res.json())
      .then((data) => {
        if (data.classes) {
          setClasses(data.classes)
          setSelectedClassIds([data.classes[0]?.id || 'c-3-1'])
        }
      })
  }, [])

  const resetForm = () => {
    setEditingAssignmentId(null)
    setTitle('')
    setDescription('')
    setType('practice')
    setGradeLevel(3)
    setAiPrompt('')
    setQuestions([createQuestion()])
    setEssayQuestion('')
    setAttachments([])
    setDurationMinutes(20)
    setMaxAttempts(1)
    setFormError('')
    setQuestionImportError('')
  }

  const openCreateModal = () => {
    resetForm()
    setIsCreateModalOpen(true)
  }

  const openEditModal = (assignment: any) => {
    setEditingAssignmentId(assignment.id)
    setTitle(assignment.title || '')
    setDescription(assignment.description || '')
    setType(assignment.type)
    setGradeLevel(assignment.gradeLevel)
    setSelectedClassIds(assignment.targetClassIds || [])
    setAiPrompt(assignment.aiPrompt || '')
    setAttachments(assignment.attachments || [])
    setDurationMinutes(assignment.durationMinutes ?? 20)
    setMaxAttempts(assignment.maxAttempts ?? 1)
    setQuestions(assignment.type === 'multiple_choice' && assignment.questions?.length
      ? assignment.questions.map((question: any) => ({
          content: question.content || '',
          options: question.options?.map((option: any) => ({ text: option.text || '', isCorrect: Boolean(option.isCorrect) })) || createQuestion().options,
          maxScore: question.maxScore || 1,
        }))
      : [createQuestion()])
    setEssayQuestion(assignment.type === 'essay' ? assignment.questions?.[0]?.content || '' : '')
    setFormError('')
    setQuestionImportError('')
    setIsCreateModalOpen(true)
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const assignmentQuestions = type === 'multiple_choice'
      ? questions.map((question) => ({ ...question, type: 'single_choice' }))
      : type === 'essay'
        ? [{ content: essayQuestion, type: 'essay', maxScore: 10 }]
        : []

    const res = await fetch(editingAssignmentId ? `/api/assignments/${editingAssignmentId}` : '/api/assignments', {
      method: editingAssignmentId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        type,
        gradeLevel,
        targetClassIds: selectedClassIds,
        aiPrompt,
        maxAttempts: Number(maxAttempts) || 0,
        durationMinutes: Number(durationMinutes) || 0,
        questions: assignmentQuestions,
        attachments,
      }),
    })

    if (res.ok) {
      setIsCreateModalOpen(false)
      resetForm()
      loadAssignments()
    } else {
      const data = await res.json()
      setFormError(data.error || 'Không thể tạo bài tập. Vui lòng thử lại.')
    }
  }

  const deleteAssignment = async (assignment: any) => {
    if (!window.confirm(`Xóa bài tập “${assignment.title}”? Các bài nộp liên quan cũng sẽ bị xóa và không thể khôi phục.`)) return
    const response = await fetch(`/api/assignments/${assignment.id}`, { method: 'DELETE' })
    if (response.ok) {
      loadAssignments()
    } else {
      const data = await response.json()
      alert(data.error || 'Không thể xóa bài tập.')
    }
  }

  const updateQuestion = (questionIndex: number, changes: Partial<QuestionDraft>) => {
    setQuestions((current) => current.map((question, index) => index === questionIndex ? { ...question, ...changes } : question))
  }

  const updateOption = (questionIndex: number, optionIndex: number, text: string) => {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question
      return { ...question, options: question.options.map((option, optionNumber) => optionNumber === optionIndex ? { ...option, text } : option) }
    }))
  }

  const setCorrectOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((current) => current.map((question, index) => {
      if (index !== questionIndex) return question
      return { ...question, options: question.options.map((option, optionNumber) => ({ ...option, isCorrect: optionNumber === optionIndex })) }
    }))
  }

  const importQuestions = async (file: File) => {
    setQuestionImportError('')
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setQuestionImportError('Vui lòng chọn file Excel định dạng .xlsx theo mẫu.')
        return
      }
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
      const normalize = (value: unknown) => String(value).trim().toLocaleLowerCase('vi-VN')
      const headers = (table[0] || []).slice(0, 6).map(normalize)
      const expected = ['noidungcauhoi', 'dapana', 'dapanb', 'dapanc', 'dapand', 'dapandung']
      if (!expected.every((header, index) => headers[index] === header)) {
        setQuestionImportError('File phải có đúng dòng tiêu đề: NoiDungCauHoi, DapAnA, DapAnB, DapAnC, DapAnD, DapAnDung.')
        return
      }
      const imported = table.slice(1).map((row, index) => {
        const correct = normalize(row[5]).replace('đáp án ', '').toUpperCase()
        const correctIndex = ['A', 'B', 'C', 'D'].indexOf(correct)
        const answers = [0, 1, 2, 3].map((answerIndex) => String(row[answerIndex + 1] || '').trim())
        if (!String(row[0] || '').trim() || answers.some((answer) => !answer) || correctIndex < 0) {
          throw new Error(`Dòng ${index + 2} chưa đủ câu hỏi, 4 đáp án hoặc đáp án đúng A/B/C/D.`)
        }
        return {
          content: String(row[0]).trim(),
          options: answers.map((text, answerIndex) => ({ text, isCorrect: answerIndex === correctIndex })),
          maxScore: 1,
        }
      }).filter((question) => question.content)
      if (!imported.length) throw new Error('File chưa có câu hỏi để nhập.')
      setQuestions((current) => current.length === 1 && !current[0].content ? imported : [...current, ...imported])
    } catch (error) {
      setQuestionImportError(error instanceof Error ? error.message : 'Không thể đọc file câu hỏi.')
    }
  }

  const uploadAttachments = async (files: FileList | null) => {
    if (!files?.length) return
    setFormError('')
    setIsUploading(true)
    try {
      const uploaded = await Promise.all(Array.from(files).map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/assignments/attachments', { method: 'POST', body: formData })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || `Không thể tải ${file.name}`)
        return data.attachment as Attachment
      }))
      setAttachments((current) => [...current, ...uploaded])
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Không thể tải tệp đính kèm.')
    } finally {
      setIsUploading(false)
    }
  }

  const toggleClassSelect = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      setSelectedClassIds(selectedClassIds.filter((id) => id !== classId))
    } else {
      setSelectedClassIds([...selectedClassIds, classId])
    }
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary-400" />
            Quản lý & Giao Bài tập Tin học
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Giao bài trắc nghiệm, tự luận, bài thực hành Word, PowerPoint, gõ phím kèm Rubric và AI prompt.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow-lg shadow-primary-500/25"
        >
          <Plus className="w-4 h-4" />
          Tạo bài tập mới
        </button>
      </div>

      {/* Assignments List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignments.map((asg) => (
          <div key={asg.id} className="glass-card gradient-border p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="badge badge-primary text-[10px]">Khối {asg.gradeLevel}</span>
                <span className="badge badge-info text-[10px]">
                  {asg.type === 'practice' ? 'Bài thực hành' : asg.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Tự luận'}
                </span>
              </div>

              <h3 className="font-bold text-base text-text-primary leading-snug">{asg.title}</h3>
              <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{asg.description}</p>
              {(asg.questions?.length > 0 || asg.attachments?.length > 0) && (
                <div className="flex flex-wrap gap-2 text-[11px] text-text-muted">
                  {asg.questions?.length > 0 && <span className="badge badge-info">{asg.questions.length} câu hỏi</span>}
                  {asg.attachments?.length > 0 && <span className="badge badge-primary flex items-center gap-1"><FileText className="w-3 h-3" /> {asg.attachments.length} tệp đính kèm</span>}
                </div>
              )}

              {/* Rubric Criteria Chips */}
              {asg.rubric?.criteria && (
                <div className="p-2.5 rounded-xl bg-surface-main/60 border border-border-default/50 space-y-1.5 text-xs">
                  <span className="text-[11px] font-semibold text-text-dim flex items-center gap-1">
                    <Layers className="w-3 h-3 text-primary-400" /> Tiêu chí Rubric:
                  </span>
                  <div className="space-y-1">
                    {asg.rubric.criteria.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[11px] text-text-secondary">
                        <span className="truncate">{c.name}</span>
                        <span className="font-mono text-primary-300 font-bold shrink-0">{c.maxScore}đ</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border-default/60 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-text-dim">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Hạn nộp:
                </span>
                <span className="text-text-secondary font-medium">
                  {new Date(asg.dueDate).toLocaleDateString('vi-VN')}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-text-dim pt-1 border-t border-border-default/30">
                <span>⏱️ {asg.durationMinutes ? `${asg.durationMinutes} phút` : 'Tự do'}</span>
                <span>🔁 Tối đa {asg.maxAttempts ? `${asg.maxAttempts} lần` : '∞ lần'}</span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                <span className="badge badge-success text-[10px] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đang nhận bài
                </span>
                <span className="text-[10px] uppercase tracking-wider text-text-dim">Thao tác</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/grading?assignmentId=${asg.id}`} className="group flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-500/15 px-3 py-2 text-xs font-semibold text-primary-300 ring-1 ring-inset ring-primary-500/30 transition-all hover:bg-primary-500 hover:text-white hover:shadow-lg hover:shadow-primary-500/20">
                    Xem bài nộp <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <button onClick={() => openEditModal(asg)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-default bg-surface-main text-text-muted transition-all hover:border-primary-400/70 hover:bg-primary-500/15 hover:text-primary-300" title="Chỉnh sửa bài tập" aria-label={`Chỉnh sửa ${asg.title}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteAssignment(asg)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border-default bg-surface-main text-text-muted transition-all hover:border-danger-400/70 hover:bg-danger-500/15 hover:text-danger-400" title="Xóa bài tập" aria-label={`Xóa ${asg.title}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create Assignment */}
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary-400" />
                {editingAssignmentId ? 'Chỉnh sửa bài tập' : 'Tạo bài tập Tin học mới'}
              </h3>
              <button onClick={() => { setIsCreateModalOpen(false); resetForm() }} className="text-text-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Tiêu đề bài tập *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Thực hành chèn hình ảnh và định dạng văn bản Word"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Khối lớp *</label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(Number(e.target.value))}
                    className="input-field text-sm bg-surface-main text-text-primary"
                  >
                    <option value={3}>Khối 3</option>
                    <option value={4}>Khối 4</option>
                    <option value={5}>Khối 5</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Hình thức bài tập *</label>
                  <select
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value)
                      setFormError('')
                    }}
                    className="input-field text-sm bg-surface-main text-text-primary"
                  >
                    <option value="practice">Bài thực hành (Nộp ảnh / File Word, PPT, Excel)</option>
                    <option value="multiple_choice">Trắc nghiệm kiến thức</option>
                    <option value="essay">Tự luận ngắn</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    ⏱️ Thời gian làm bài (Phút)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Không giới hạn"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(0, Number(e.target.value)))}
                    className="input-field text-sm"
                  />
                  <p className="text-[10px] text-text-dim mt-0.5">
                    {durationMinutes > 0 ? `Đếm ngược ${durationMinutes} phút, hết giờ auto nộp` : 'Làm tự do không tính giờ'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    🔁 Số lần làm bài tối đa
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 = Không giới hạn"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Math.max(0, Number(e.target.value)))}
                    className="input-field text-sm"
                  />
                  <p className="text-[10px] text-text-dim mt-0.5">
                    {maxAttempts > 0 ? `Học sinh được nộp tối đa ${maxAttempts} lần` : 'Không giới hạn số lần làm'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Hướng dẫn làm bài</label>
                <textarea
                  rows={3}
                  placeholder="Nêu rõ yêu cầu bài tập cho học sinh..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              {type === 'multiple_choice' && (
                <div className="space-y-3 rounded-xl border border-primary-500/30 bg-primary-500/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">Câu hỏi trắc nghiệm</h4>
                      <p className="text-[11px] text-text-muted">Chọn một đáp án đúng cho mỗi câu hỏi.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="/templates/mau_cau_hoi.xlsx"
                        download="mau_cau_hoi.xlsx"
                        className="btn-secondary text-xs flex items-center gap-1.5 hover:text-primary-300"
                        title="Tải file Excel mẫu câu hỏi trắc nghiệm"
                      >
                        <Download className="w-3.5 h-3.5 text-primary-400" /> Tải file mẫu
                      </a>
                      <label className="btn-secondary cursor-pointer text-xs flex items-center gap-1.5">
                        <FileUp className="w-3.5 h-3.5" /> Nhập file Excel
                        <input
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          onChange={(event) => event.target.files?.[0] && importQuestions(event.target.files[0])}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                  <p className="rounded-md bg-surface-main/70 p-2 text-[11px] text-text-muted">
                    File .xlsx có dòng đầu gồm đúng 6 cột: <strong>NoiDungCauHoi | DapAnA | DapAnB | DapAnC | DapAnD | DapAnDung</strong>. Cột <strong>DapAnDung</strong> nhập A, B, C hoặc D; mỗi câu mặc định 1 điểm.
                  </p>
                  {questionImportError && <p className="text-xs text-danger-400">{questionImportError}</p>}

                  {questions.map((question, questionIndex) => (
                    <div key={questionIndex} className="space-y-2 rounded-lg border border-border-default bg-surface-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-primary-300">Câu {questionIndex + 1}</span>
                        {questions.length > 1 && (
                          <button type="button" onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))} className="text-xs text-danger-400 hover:text-danger-300 flex items-center gap-1">
                            <Trash2 className="w-3.5 h-3.5" /> Xóa
                          </button>
                        )}
                      </div>
                      <textarea rows={2} required value={question.content} onChange={(event) => updateQuestion(questionIndex, { content: event.target.value })} placeholder="Nhập nội dung câu hỏi" className="input-field text-xs" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {question.options.map((option, optionIndex) => (
                          <label key={optionIndex} className="flex items-center gap-2 rounded-md border border-border-default/70 px-2 py-1.5 text-xs text-text-secondary">
                            <input type="radio" name={`correct-answer-${questionIndex}`} checked={option.isCorrect} onChange={() => setCorrectOption(questionIndex, optionIndex)} className="accent-primary-500" />
                            <span className="font-semibold">{String.fromCharCode(65 + optionIndex)}.</span>
                            <input required value={option.text} onChange={(event) => updateOption(questionIndex, optionIndex, event.target.value)} placeholder={`Đáp án ${String.fromCharCode(65 + optionIndex)}`} className="min-w-0 flex-1 bg-transparent outline-none" />
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <label htmlFor={`score-${questionIndex}`}>Điểm:</label>
                        <input id={`score-${questionIndex}`} type="number" min="0.1" step="0.1" value={question.maxScore} onChange={(event) => updateQuestion(questionIndex, { maxScore: Number(event.target.value) })} className="input-field w-20 py-1 text-xs" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setQuestions((current) => [...current, createQuestion()])} className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center gap-1">
                    <ListPlus className="w-4 h-4" /> Thêm một câu hỏi
                  </button>
                </div>
              )}

              {type === 'essay' && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Câu hỏi tự luận *</label>
                  <textarea rows={4} required value={essayQuestion} onChange={(event) => setEssayQuestion(event.target.value)} placeholder="Nhập câu hỏi hoặc yêu cầu để học sinh trả lời trực tiếp bằng văn bản..." className="input-field text-xs" />
                </div>
              )}

              {type === 'practice' && (
                <div className="space-y-2 rounded-xl border border-accent-500/30 bg-accent-500/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-0.5">Tệp đính kèm cho đề bài</label>
                      <p className="text-[11px] text-text-muted">Hỗ trợ ảnh, Word, PowerPoint, Excel, PDF, Scratch (.sb3); tối đa 25 MB mỗi tệp.</p>
                    </div>
                    <span className="text-[10px] text-accent-300 bg-accent-500/15 border border-accent-500/30 px-2 py-0.5 rounded-full font-medium">
                      ☁️ Cloudinary Storage
                    </span>
                  </div>
                  <input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx,.pdf,.sb3,.zip" onChange={(event) => uploadAttachments(event.target.files)} disabled={isUploading} className="input-field text-xs file:mr-3 file:rounded-md file:border-0 file:bg-accent-500/15 file:px-3 file:py-1.5 file:text-accent-300 cursor-pointer" />
                  {isUploading && <p className="text-xs text-accent-300 animate-pulse">Đang tải tệp lên Cloudinary (eduai/teacher/assignments)...</p>}
                  {attachments.length > 0 && (
                    <ul className="space-y-1.5 text-xs text-text-secondary pt-1">
                      {attachments.map((attachment) => (
                        <li key={attachment.url} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-surface-main/60 border border-border-default/60">
                          <a href={attachment.url} target="_blank" rel="noreferrer" className="truncate text-primary-300 hover:underline flex items-center gap-1.5">
                            <span>📄 {attachment.name}</span>
                            <span className="text-[10px] text-text-muted">({(attachment.size / 1024).toFixed(1)} KB)</span>
                          </a>
                          <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.url !== attachment.url))} className="text-danger-400 hover:text-danger-300 text-[11px] font-semibold px-2 py-0.5">
                            Xóa
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Phân phối giao bài cho các lớp:
                </label>
                <div className="flex flex-wrap gap-2">
                  {classes.map((cls) => {
                    const selected = selectedClassIds.includes(cls.id)
                    return (
                      <button
                        type="button"
                        key={cls.id}
                        onClick={() => toggleClassSelect(cls.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          selected
                            ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                            : 'bg-surface-main border-border-default text-text-muted hover:text-white'
                        }`}
                      >
                        Lớp {cls.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {formError && <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-400">{formError}</div>}

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Chỉ dẫn bổ sung cho AI (Prompt riêng cho bài tập này)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Chấm gắt gao tiêu chí chèn đúng vị trí ảnh, kiểm tra tỷ lệ ảnh không bị méo"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="input-field text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => { setIsCreateModalOpen(false); resetForm() }} className="btn-secondary text-xs">
                  Hủy
                </button>
                <button type="submit" disabled={isUploading} className="btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60">
                  {editingAssignmentId ? 'Lưu thay đổi' : 'Giao bài tập'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
