'use client'

import { useState, useEffect } from 'react'
import { Calendar, Plus, Archive, CheckCircle2, Clock, X } from 'lucide-react'

export default function SchoolYearsPage() {
  const [years, setYears] = useState<any[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [yearName, setYearName] = useState('')
  const [startYear, setStartYear] = useState('2027')
  const [endYear, setEndYear] = useState('2028')

  const loadYears = () => {
    fetch('/api/school-years')
      .then((res) => res.json())
      .then((data) => {
        if (data.schoolYears) setYears(data.schoolYears)
      })
  }

  useEffect(() => {
    loadYears()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/school-years', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: yearName || `Năm học ${startYear} - ${endYear}`,
        startYear: Number(startYear),
        endYear: Number(endYear),
        isActive: false,
      }),
    })
    if (res.ok) {
      setIsAddModalOpen(false)
      loadYears()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary-400" />
            Quản lý Năm học
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Bảo toàn lịch sử bài làm khi chuyển năm học, lưu trữ dữ liệu an toàn.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow-lg shadow-primary-500/25"
        >
          <Plus className="w-4 h-4" />
          Tạo năm học mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {years.map((y) => (
          <div key={y.id} className="glass-card gradient-border p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-text-primary">{y.name}</h3>
                <p className="text-xs text-text-muted">
                  Thời gian: {y.startYear} - {y.endYear}
                </p>
              </div>
              {y.isActive ? (
                <span className="badge badge-success text-xs flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Đang hoạt động
                </span>
              ) : (
                <span className="badge badge-warning text-xs flex items-center gap-1">
                  <Archive className="w-3.5 h-3.5" /> Đã lưu trữ
                </span>
              )}
            </div>

            <p className="text-xs text-text-dim leading-relaxed">
              {y.isActive
                ? 'Năm học hiện hành tiếp nhận bài nộp, giao bài và phân tích kết quả học tập.'
                : 'Dữ liệu được lưu trữ an toàn. Lịch sử bài làm và điểm số được bảo toàn nguyên vẹn.'}
            </p>

            <div className="pt-3 border-t border-border-default/60 flex items-center justify-between text-xs">
              <span className="text-text-muted">Trạng thái dữ liệu: Sẵn sàng</span>
              {y.isActive ? (
                <span className="text-accent-400 font-semibold">Năm học chính thức</span>
              ) : (
                <button className="text-primary-400 hover:underline">Kích hoạt năm này</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <h3 className="font-bold text-lg text-text-primary">Tạo năm học mới</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-text-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Tên năm học</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Năm học 2027 - 2028"
                  value={yearName}
                  onChange={(e) => setYearName(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Năm bắt đầu</label>
                  <input
                    type="number"
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Năm kết thúc</label>
                  <input
                    type="number"
                    value={endYear}
                    onChange={(e) => setEndYear(e.target.value)}
                    className="input-field text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-secondary text-xs">
                  Hủy
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Lưu năm học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
