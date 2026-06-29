import type { Metadata } from 'next'
import { Inter, Saira_Condensed } from 'next/font/google'
import './globals.css'
import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const saira = Saira_Condensed({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-saira',
  style: 'normal',
})

export const metadata: Metadata = {
  title: 'Prode Internacional · World Cup 2026',
  description: 'World Cup 2026 prediction pool',
  manifest: '/manifest.json',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" className={`${inter.variable} ${saira.variable}`}>
      <body className="min-h-screen bg-[var(--bg)]">
        {user && <AppHeader user={user} />}
        <main className="max-w-2xl mx-auto px-4 pb-24">{children}</main>
        <footer className="text-center py-8 text-[var(--muted)] text-xs">
          <span className="font-display text-[var(--gold)]">PRODE INTERNATIONAL</span>
          <span className="ml-1 px-1.5 py-0.5 border border-[var(--border)] rounded text-[10px]">2026</span>
          <p className="mt-1">Not a betting site</p>
        </footer>
      </body>
    </html>
  )
}
