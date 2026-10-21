'use client'

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  X,
  Copy,
  Check,
} from 'lucide-react'

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // Single add form
  const [newFullName, setNewFullName] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newClassId, setNewClassId] = useState('')
  const [formError, setFormError] = useState('')

  // Batch import state
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importClassId, setImportClassId] = useState('')
  const [importResult, setImportResult] = useState<any>(null)
  const [importError, setImportError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadStudents = () => {
    setIsLoading(true)
    fetch('/api/students')
      .then((res) => res.json())
      .then((data) => {
        if (data.students) setStudents(data.students)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    loadStudents()
    fetch('/api/classes')
      .then((res) => res.json())
      .then((data) => {
        if (data.classes) {
          setClasses(data.classes)
          if (data.classes[0]) {
            setNewClassId(data.classes[0].id)
            setImportClassId(data.classes[0].id)
          }
        }
      })
  }, [])

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newFullName,
          username: newUsername,
          password: newPassword,
          classId: newClassId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Lỗi thêm học sinh')
        return
      }

      setIsAddModalOpen(false)
      setNewFullName('')
      setNewUsername('')
      setNewPassword('')
      loadStudents()
    } catch {
      setFormError('Lỗi kết nối máy chủ')
    }
  }

  const handleBatchImport = async () => {
    try {
      setImportError('')
      setImportResult(null)
      if (!importFile) {
        setImportError('Vui lòng chọn file Excel hoặc CSV trước khi nhập.')
        return
      }
      if (!importClassId) {
        setImportError('Vui lòng chọn lớp nhận danh sách học sinh.')
        return
      }

      const workbook = XLSX.read(await importFile.arrayBuffer(), { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const table = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        defval: '',
        raw: false,
      })
      const header = (table[0] || []).slice(0, 3).map((value) => String(value).trim().toLocaleLowerCase('vi-VN'))
      if (header[0] !== 'họ và tên' || header[1] !== 'tên đăng nhập' || header[2] !== 'mật khẩu') {
        setImportError('File chưa đúng mẫu. Dòng đầu tiên phải gồm: Họ và tên, Tên đăng nhập, Mật khẩu.')
        return
      }

      const rows = table.slice(1).map((line) => ({
        fullName: String(line[0] || '').trim(),
        username: String(line[1] || '').trim(),
        password: String(line[2] || '').trim(),
      })).filter((row) => row.fullName || row.username || row.password)

      if (rows.length === 0) {
        setImportError('File chưa có học sinh nào để nhập.')
        return
      }

      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, classId: importClassId }),
      })

      const data = await res.json()
      if (!res.ok) {
        setImportError(data.error || 'Không thể nhập danh sách học sinh.')
        return
      }
      setImportResult(data)
      loadStudents()
    } catch {
      setImportError('Không thể đọc file. Vui lòng dùng file .xlsx, .xls hoặc .csv theo đúng mẫu.')
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredStudents = students.filter((s) => {
    const matchClass = selectedClass === 'all' || s.classId === selectedClass
    const matchQuery =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentId.toLowerCase().includes(searchQuery.toLowerCase())
    return matchClass && matchQuery
  })

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-400" />
            Hồ sơ & Tài khoản Học sinh
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Quản lý mã định danh, cấp thông tin đăng nhập tự động và theo dõi lớp học.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="btn-secondary text-xs flex items-center gap-2 py-2 px-3.5"
          >
            <KeyRound className="w-4 h-4 text-warning-400" />
            Xuất thẻ tài khoản
          </button>
          <button
            onClick={() => {
              setImportResult(null)
              setImportError('')
              setImportFile(null)
              setIsImportModalOpen(true)
            }}
            className="btn-secondary text-xs flex items-center gap-2 py-2 px-3.5 border-primary-500/30"
          >
            <FileSpreadsheet className="w-4 h-4 text-accent-400" />
            Nhập file Excel
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary text-xs flex items-center gap-2 py-2 px-4 shadow-lg shadow-primary-500/25"
          >
            <UserPlus className="w-4 h-4" />
            Thêm học sinh
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            type="text"
            placeholder="Tìm theo tên đăng nhập hoặc họ tên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9 text-xs py-2"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-text-muted" />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="input-field text-xs py-2 bg-surface-main text-text-primary cursor-pointer"
          >
            <option value="all">Tất cả các lớp ({students.length})</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                Lớp {cls.name} ({cls.studentCount} HS)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Họ và tên</th>
                <th>Lớp học</th>
                <th>Email hệ thống</th>
                <th>Mật khẩu khởi tạo</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-text-dim">
                    Đang tải danh sách học sinh...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-text-muted">
                    Không tìm thấy học sinh nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((st) => (
                  <tr key={st.id}>
                    <td className="font-mono font-semibold text-primary-300">{st.username || st.studentId}</td>
                    <td className="font-medium text-text-primary">{st.fullName}</td>
                    <td>
                      <span className="badge badge-info">{st.className}</span>
                    </td>
                    <td className="text-xs text-text-muted font-mono">{st.email}</td>
                    <td>
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-input border border-border-default/40 font-mono text-xs text-accent-300">
                        <span>{st.initialPassword || '••••••••'}</span>
                        <button
                          onClick={() => copyToClipboard(st.initialPassword || '', st.id)}
                          className="hover:text-white transition-colors"
                          title="Sao chép mật khẩu"
                        >
                          {copiedId === st.id ? <Check className="w-3.5 h-3.5 text-accent-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-success text-[11px] flex items-center gap-1 w-max">
                        <CheckCircle2 className="w-3 h-3" /> Đang học
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Single Student */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-400" />
                Thêm học sinh mới
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-text-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4 mt-4">
              {formError && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Tên đăng nhập (Duy nhất) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: nguyenvana"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Họ và tên học sinh *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Hoàng Nam"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Mật khẩu *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 123456"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Lớp tiếp nhận *
                </label>
                <select
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="input-field text-sm bg-surface-main text-text-primary"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-primary-500/10 border border-primary-500/20 text-xs text-primary-300">
                💡 Tên đăng nhập phải chưa có trong hệ thống. Thông tin này sẽ được cấp cho học sinh để đăng nhập.
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Xác nhận & Cấp tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Excel Batch Import */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content max-w-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-accent-400" />
                Nhập danh sách học sinh hàng loạt từ Excel
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-text-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Chọn lớp nhập dữ liệu:
                </label>
                <select
                  value={importClassId}
                  onChange={(e) => setImportClassId(e.target.value)}
                  className="input-field text-sm bg-surface-main text-text-primary"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Chọn file Excel (.xlsx, .xls) hoặc CSV:
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="input-field text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary-500/15 file:px-3 file:py-1.5 file:text-primary-300"
                />
                <p className="mt-2 text-xs text-text-muted">
                  Dòng đầu tiên là tiêu đề; ba cột theo thứ tự: <strong>Họ và tên</strong>, <strong>Tên đăng nhập</strong>, <strong>Mật khẩu</strong>.
                </p>
                <div className="mt-3 overflow-x-auto rounded-lg border border-border-default/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-input text-text-secondary"><tr><th className="p-2">Cột A</th><th className="p-2">Cột B</th><th className="p-2">Cột C</th></tr></thead>
                    <tbody><tr className="border-t border-border-default/60"><td className="p-2">Họ và tên</td><td className="p-2">Tên đăng nhập</td><td className="p-2">Mật khẩu</td></tr><tr className="border-t border-border-default/60 text-text-muted"><td className="p-2">Nguyễn Văn A</td><td className="p-2">nguyenvana</td><td className="p-2">123456</td></tr></tbody>
                  </table>
                </div>
              </div>

              {importError && (
                <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-xs">
                  {importError}
                </div>
              )}

              {importResult && (
                <div className="p-3 rounded-lg bg-surface-card border border-accent-500/30 text-xs space-y-2">
                  <p className="font-semibold text-accent-400">{importResult.message}</p>
                  {importResult.results?.duplicates?.length > 0 && (
                    <p className="text-warning-400">
                      ⚠️ Tên đăng nhập trùng lặp: {importResult.results.duplicates.join(', ')}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Đóng
                </button>
                <button
                  onClick={handleBatchImport}
                  className="btn-primary text-xs flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Xử lý & Cấp tài khoản hàng loạt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Export Account Cards */}
      {isExportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content max-w-3xl">
            <div className="flex items-center justify-between pb-3 border-b border-border-default">
              <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-warning-400" />
                Phiếu phân phối thông tin đăng nhập học sinh
              </h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-text-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-text-muted">
                Thầy cô có thể in phiếu này hoặc phát trực tiếp cho từng học sinh để các em đăng nhập làm bài Tin học.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-1">
                {filteredStudents.map((st) => (
                  <div key={st.id} className="p-3 rounded-xl bg-surface-card border border-border-default space-y-1.5 text-xs">
                    <div className="flex items-center justify-between border-b border-border-default/40 pb-1">
                      <span className="font-bold text-text-primary">{st.fullName}</span>
                      <span className="badge badge-info text-[10px]">Lớp {st.className}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <span className="text-text-dim">Tên đăng nhập:</span>
                      <span className="font-mono text-primary-300 font-semibold">{st.username || st.studentId}</span>
                      <span className="text-text-dim">Email hệ thống:</span>
                      <span className="font-mono text-text-secondary truncate">{st.email}</span>
                      <span className="text-text-dim">Mật khẩu ban đầu:</span>
                      <span className="font-mono text-accent-300 font-bold">{st.initialPassword}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  onClick={() => window.print()}
                  className="btn-primary text-xs flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  In danh sách phiếu tài khoản
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
