'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { Target, Trophy, Users, Crown, Newspaper, BookOpen, ShieldAlert } from 'lucide-react'

const NAV = [
  { href: '/predict',    label: 'Predict',  Icon: Target },
  { href: '/ranking',    label: 'Ranking',  Icon: Trophy },
  { href: '/groups',     label: 'Groups',   Icon: Users },
  { href: '/champion',   label: 'Champion', Icon: Crown },
  { href: '/chronicles', label: 'Scoop',    Icon: Newspaper },
  { href: '/rules',      label: 'Rules',    Icon: BookOpen },
]

export function AppHeader({ user, isAdmin = false }: { user: User; isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-2xl mx-auto px-4 flex items-center gap-4 h-14">
        <Link href="/" className="font-display text-xl text-[var(--gold)] mr-auto">
          SUPER <span className="text-[var(--muted)]">PRODE</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? 'bg-[var(--surface-2)] text-[var(--gold)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname.startsWith('/admin')
                  ? 'bg-[var(--surface-2)] text-[var(--red)]'
                  : 'text-[var(--muted)] hover:text-[var(--red)]'
              }`}
            >
              Admin
            </Link>
          )}
        </nav>
        <button
          onClick={signOut}
          className="text-xs text-[var(--muted)] hover:text-[var(--red)] transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 bg-[var(--surface)] border-t border-[var(--border)] flex z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 min-w-0 transition-opacity duration-75 active:opacity-50 ${
                active ? 'text-[var(--gold)]' : 'text-[var(--muted)]'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.75} />
              <span className="text-[10px] font-medium leading-none tracking-wide">{label}</span>
            </Link>
          )
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 min-w-0 transition-opacity duration-75 active:opacity-50 ${
              pathname.startsWith('/admin') ? 'text-[var(--red)]' : 'text-[var(--muted)]'
            }`}
          >
            <ShieldAlert size={20} strokeWidth={pathname.startsWith('/admin') ? 2.5 : 1.75} />
            <span className="text-[10px] font-medium leading-none tracking-wide">Admin</span>
          </Link>
        )}
      </nav>
    </header>
  )
}
