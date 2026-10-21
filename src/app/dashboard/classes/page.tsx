'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  GraduationCap,
  Plus,
  Users,
  Building2,
  Calendar,
  X,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([])
  const [grades, setGrades] = useState<any[]>([])
  const [selectedGrade, setSelectedGrade] = useState<number | 'all'>('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // Form
  const [className, setClassName] = useState('')
  const [classCode, setClassCode] = useState('')
  const [gradeId, setGradeId] = useState('g-3')
  const [formError, setFormError] = useState('')

  const loadData = () => {
    fetch('/api/classes')
      .then((res) => res.json())
      .then((data) => {
        if (data.classes) setClasses(data.classes)
      })

    fetch('/api/grades')
      .then((res) => res.json())
      .then((data) => {
        if (data.grades) setGrades(data.grades)
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: className,
          code: classCode,
          schoolYearId: 'sy-2026-2027',
          gradeId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Lỗi tạo lớp học')
        return
      }

      setIsAddModalOpen(false)
      setClassName('')
      setClassCode('')
      loadData()
    } catch {
      setFormError('Lỗi máy chủ')
    }
  }

  const filteredClasses = classes.filter((c) => {
    if (selectedGrade === 'all') return true
    const gLevel = Number(c.name.split('/')[0])
    return gLevel === selectedGrade
  })

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary-400" />
            Quản lý Khối & Lớp học Tin học
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Tổ chức lớp học theo năm học 2026 - 2027, phân loại khối 1 đến 5 và quản trị danh sách.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow-lg shadow-primary-500/25 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Thêm lớp học mới
        </button>
      </div>

      {/* Grade Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedGrade('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            selectedGrade === 'all'
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
              : 'bg-surface-card border border-border-default text-text-muted hover:text-white'
          }`}
        >
          Tất cả khối ({classes.length} lớp)
        </button>
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            onClick={() => setSelectedGrade(level)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              selectedGrade === level
                ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                : 'bg-surface-card border border-border-default text-text-muted hover:text-white'
            }`}
          >
            Khối {level}
          </button>
        ))}
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClasses.map((cls) => (
          <div key={cls.id} className="glass-card gradient-border p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="badge badge-primary text-xs mb-1">{cls.code}</span>
                <h3 className="text-xl font-bold text-text-primary">Lớp {cls.name}</h3>
              </div>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500/20 to-purple-500/20 flex items-center justify-center font-bold text-lg text-primary-300">
                {cls.name}
              </div>
            </div>

            <div className="space-y-2 text-xs text-text-muted">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-text-dim">
                  <Calendar className="w-3.5 h-3.5" /> Năm học:
                </span>
                <span className="font-medium text-text-secondary">2026 - 2027</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-text-dim">
                  <Building2 className="w-3.5 h-3.5" /> Giáo viên phụ trách:
                </span>
                <span className="font-medium text-text-secondary">{cls.teacherName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-text-dim">
                  <Users className="w-3.5 h-3.5" /> Sĩ số học sinh:
                </span>
                <span className="font-bold text-accent-400">{cls.studentCount} Học sinh</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border-default/60 flex items-center justify-between">
              <span className="badge badge-success text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Đang hoạt động
              </span>
              <Link
                href={`/dashboard/students?classId=${cls.id}`}
                className="text-xs font-semibold text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                Xem học sinh <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Add Class */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary-400" />
                Tạo lớp học mới
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-text-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4 mt-4">
              {formError && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Tên lớp học *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 3/3 hoặc 4/3"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Mã định danh lớp (Mã lớp) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: TIN-303-26"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  className="input-field text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Thuộc khối lớp *
                </label>
                <select
                  value={gradeId}
                  onChange={(e) => setGradeId(e.target.value)}
                  className="input-field text-sm bg-surface-main text-text-primary"
                >
                  <option value="g-1">Khối 1</option>
                  <option value="g-2">Khối 2</option>
                  <option value="g-3">Khối 3</option>
                  <option value="g-4">Khối 4</option>
                  <option value="g-5">Khối 5</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Tạo lớp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
