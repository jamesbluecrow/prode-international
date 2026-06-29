'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/predict', label: 'Predict' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/groups', label: 'Groups' },
  { href: '/champion', label: 'Champion' },
  { href: '/chronicles', label: 'Chronicles' },
  { href: '/rules', label: 'Rules' },
]

export function AppHeader({ user }: { user: User }) {
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
        </nav>
        <button
          onClick={signOut}
          className="text-xs text-[var(--muted)] hover:text-[var(--red)] transition-colors"
        >
          Sign out
        </button>
      </div>
      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-[var(--surface)] border-t border-[var(--border)] flex z-50">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
              pathname.startsWith(href) ? 'text-[var(--gold)]' : 'text-[var(--muted)]'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
