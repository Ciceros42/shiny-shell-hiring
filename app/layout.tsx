import type { Metadata } from 'next'
import './globals.css'
import ThemeInitializer from '@/components/admin/ThemeInitializer'

export const metadata: Metadata = {
  title: 'Hiring Portal',
  description: 'AI-powered hiring, built for carwash operators.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" data-theme="1">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <ThemeInitializer />
        {children}
      </body>
    </html>
  )
}
