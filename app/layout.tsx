import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hiring Portal',
  description: 'AI-powered hiring, built for carwash operators.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
