import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EduAI - Nền tảng Giáo dục AI cho Giáo viên Tin học',
  description: 'Hệ thống quản lý lớp học, giao bài tập và AI hỗ trợ chấm điểm dành cho giáo viên Tin học tiểu học.',
  keywords: 'education, AI grading, teacher tools, primary school, computer science',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
