import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ThemeInitializer from '@/components/admin/ThemeInitializer'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Hiring Portal',
  description: 'AI-powered hiring, built for carwash operators.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`} data-theme="1">
      <body className="min-h-full flex flex-col antialiased" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>
        <ThemeInitializer />
        {children}
      </body>
    </html>
  )
}
