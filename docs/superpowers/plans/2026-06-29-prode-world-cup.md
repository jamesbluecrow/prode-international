# Prode World Cup 2026 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a friends prediction pool for the 2026 World Cup with score predictions, private groups, and a leaderboard matching prodegame.fun scoring.

**Architecture:** Next.js App Router with Supabase backend; scoring logic in `lib/scoring.ts`; two Supabase clients (`server.ts` for RSC/actions, `client.ts` for browser); middleware guards `/admin` and refreshes sessions.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + RLS) · @supabase/ssr

## Global Constraints

- Tailwind CSS only for styling — no other CSS-in-JS
- `@supabase/ssr` for both server and browser clients
- All DB-enforced authorization stays in SQL/RLS — frontend is display only
- Scoring: exact 10 / correct GD 7 / correct winner 5 / wrong 0; knockout floor 3 for right advancer; +3 if predicted draw and correct shootout winner
- Design tokens: `--bg:#0a0e17 --surface:#11141d --surface-2:#181c27 --border:#232838 --text:#f2f5fb --muted:#7d8699 --gold:#f5c542 --gold-2:#e0a72e --green:#34d399 --blue:#4c8dff --red:#f87171`
- Fonts: `Saira_Condensed` (700–800, headings) + `Inter` (body) from Google Fonts
- Flags: `https://flagcdn.com/w40/<code>.png`
- Supabase project ID: `dltgbifqdwnynimhiguf`

---

### Task 1: Supabase Clients + Middleware + Types

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/types.ts`
- Create: `middleware.ts`
- Create: `.env.local` (template — user fills values)

**Interfaces:**
- Produces: `createClient()` (server), `createBrowserClient()` (browser), `Database` type, auth middleware

- [ ] **Step 1: Create `.env.local` template**

```
NEXT_PUBLIC_SUPABASE_URL=https://dltgbifqdwnynimhiguf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 2: Create `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/lib/types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Create `lib/types.ts`** (hand-authored until `supabase gen types` is run)

```typescript
export type Stage = 'group' | 'round_of_32' | 'round_of_16' | 'quarter' | 'semi' | 'third_place' | 'final'
export type Side = 'home' | 'away'

export interface Profile {
  id: string
  display_name: string
  is_admin: boolean
  created_at: string
}

export interface Match {
  id: string
  stage: Stage
  match_no: number | null
  home_team: string
  away_team: string
  home_code: string | null
  away_code: string | null
  kickoff_at: string
  home_score: number | null
  away_score: number | null
  penalty_winner: Side | null
  is_knockout: boolean
  predictions_locked: boolean
  force_open: boolean
  result_final: boolean
  created_at: string
}

export interface Prediction {
  id: string
  user_id: string
  match_id: string
  pred_home: number
  pred_away: number
  pred_advancer: Side | null
  created_at: string
  updated_at: string
}

export interface PredictionScore {
  id: string
  user_id: string
  match_id: string
  pred_home: number
  pred_away: number
  pred_advancer: Side | null
  stage: Stage
  is_knockout: boolean
  home_score: number | null
  away_score: number | null
  penalty_winner: Side | null
  result_final: boolean
  points: number | null
}

export interface PhaseDeadline {
  stage: Stage
  lock_at: string
}

export interface TournamentBonus {
  id: string
  key: string
  label: string
  points: number
  correct_answer: string | null
  locked: boolean
  lock_at: string | null
  is_active: boolean
  created_at: string
}

export interface BonusPrediction {
  id: string
  user_id: string
  bonus_id: string
  answer: string
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  name: string
  region: string | null
  avatar_url: string | null
  invite_code: string
  created_by: string | null
  max_players: number
  created_at: string
}

export interface GroupMember {
  group_id: string
  user_id: string
  joined_at: string
}

export interface LeaderboardRow {
  user_id: string
  display_name: string
  total_points: number
  exact_hits: number
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Profile> }
      matches: { Row: Match; Insert: Omit<Match, 'id' | 'created_at'>; Update: Partial<Match> }
      predictions: { Row: Prediction; Insert: Omit<Prediction, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Prediction> }
      phase_deadlines: { Row: PhaseDeadline; Insert: PhaseDeadline; Update: Partial<PhaseDeadline> }
      tournament_bonuses: { Row: TournamentBonus; Insert: Omit<TournamentBonus, 'id' | 'created_at'>; Update: Partial<TournamentBonus> }
      bonus_predictions: { Row: BonusPrediction; Insert: Omit<BonusPrediction, 'id' | 'created_at' | 'updated_at'>; Update: Partial<BonusPrediction> }
      groups: { Row: Group; Insert: Omit<Group, 'id' | 'created_at'>; Update: Partial<Group> }
      group_members: { Row: GroupMember; Insert: GroupMember; Update: Partial<GroupMember> }
    }
    Views: {
      prediction_scores: { Row: PredictionScore }
      leaderboard: { Row: LeaderboardRow }
    }
    Functions: {
      is_admin: { Args: Record<never, never>; Returns: boolean }
      match_open: { Args: { p_match_id: string }; Returns: boolean }
      create_group: { Args: { p_name: string; p_region?: string }; Returns: Group }
      join_group: { Args: { p_code: string }; Returns: Group }
      group_leaderboard: { Args: { p_group: string }; Returns: LeaderboardRow[] }
    }
  }
}
```

- [ ] **Step 5: Create `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated to /login
  if (!user && !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Guard /admin
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user!.id)
      .single()
    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add lib/ middleware.ts .env.local
git commit -m "feat: add Supabase clients, types, and middleware"
```

---

### Task 2: Design System + Root Layout

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `components/AppHeader.tsx`
- Modify: `tailwind.config.ts` (if it exists; else `tailwind.config.js`)

**Interfaces:**
- Consumes: auth session via `createClient()` (server)
- Produces: global CSS vars, `AppHeader` component, root layout with fonts

- [ ] **Step 1: Update `app/globals.css`**

```css
@import "tailwindcss";

:root {
  --bg: #0a0e17;
  --surface: #11141d;
  --surface-2: #181c27;
  --border: #232838;
  --text: #f2f5fb;
  --muted: #7d8699;
  --gold: #f5c542;
  --gold-2: #e0a72e;
  --green: #34d399;
  --blue: #4c8dff;
  --red: #f87171;
}

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
}

.font-display {
  font-family: 'Saira Condensed', sans-serif;
  font-weight: 800;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.tabular { font-variant-numeric: tabular-nums; }
```

- [ ] **Step 2: Update `app/layout.tsx`**

```typescript
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
  style: ['italic', 'normal'],
})

export const metadata: Metadata = {
  title: 'Prode Mundial 2026',
  description: 'Tu prode del Mundial 2026',
  manifest: '/manifest.json',
  themeColor: '#0a0e17',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="es" className={`${inter.variable} ${saira.variable}`}>
      <body className="min-h-screen bg-[var(--bg)]">
        {user && <AppHeader user={user} />}
        <main className="max-w-2xl mx-auto px-4 pb-24">{children}</main>
        <footer className="text-center py-8 text-[var(--muted)] text-xs">
          <span className="font-display text-[var(--gold)]">PRODE</span>
          <span className="ml-1 px-1.5 py-0.5 border border-[var(--border)] rounded text-[10px]">2026</span>
          <p className="mt-1">No somos una casa de apuestas</p>
        </footer>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create `components/AppHeader.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/predict', label: 'Predecir' },
  { href: '/ranking', label: 'Ranking' },
  { href: '/groups', label: 'Grupos' },
  { href: '/champion', label: 'Campeón' },
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
          PRODE <span className="text-[var(--muted)]">2026</span>
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
          Salir
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
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx components/AppHeader.tsx
git commit -m "feat: add design system tokens and root layout with AppHeader"
```

---

### Task 3: Auth — Login Page + Callback

**Files:**
- Create: `app/login/page.tsx`
- Create: `app/auth/callback/route.ts`

**Interfaces:**
- Consumes: `createClient()` (server) for OTP, `createClient()` (browser) for OAuth
- Produces: authenticated session cookies

- [ ] **Step 1: Create `app/login/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-4xl text-center mb-2">
          <span className="text-[var(--muted)]">PRODE</span>{' '}
          <span className="text-[var(--gold)]">MUNDIAL</span>
        </h1>
        <p className="text-center text-[var(--muted)] text-sm mb-8">2026</p>
        <LoginForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/login/LoginForm.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setSent(true)
    setLoading(false)
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  if (sent) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 text-center">
        <p className="text-[var(--green)] font-medium mb-2">¡Enlace enviado!</p>
        <p className="text-[var(--muted)] text-sm">Revisá tu correo <strong className="text-[var(--text)]">{email}</strong></p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
      <form onSubmit={sendMagicLink} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--gold)] text-[var(--bg)] font-bold py-3 rounded-lg hover:bg-[var(--gold-2)] transition-colors disabled:opacity-50"
        >
          {loading ? 'Enviando…' : 'Entrar con Email'}
        </button>
      </form>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]" />
        </div>
        <div className="relative text-center">
          <span className="bg-[var(--surface)] px-3 text-xs text-[var(--muted)]">o</span>
        </div>
      </div>
      <button
        onClick={signInWithGoogle}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-medium py-3 rounded-lg hover:border-[var(--muted)] transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continuar con Google
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/auth/callback/route.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/`)
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/login/ app/auth/
git commit -m "feat: add magic link + Google OAuth login and auth callback"
```

---

### Task 4: Scoring Logic + Core Prediction Components

**Files:**
- Create: `lib/scoring.ts`
- Create: `components/ScoreInput.tsx`
- Create: `components/AdvancerPicker.tsx`
- Create: `components/LockBanner.tsx`
- Create: `components/MatchCard.tsx`

**Interfaces:**
- Consumes: `Match`, `Prediction`, `PredictionScore` from `lib/types.ts`
- Produces: `calculatePoints()`, `ScoreInput`, `AdvancerPicker`, `LockBanner`, `MatchCard`

- [ ] **Step 1: Create `lib/scoring.ts`**

```typescript
import type { Side } from '@/lib/types'

export interface ScorelineInput {
  predHome: number
  predAway: number
  actualHome: number
  actualAway: number
}

export function calcScale({ predHome, predAway, actualHome, actualAway }: ScorelineInput): number {
  if (predHome === actualHome && predAway === actualAway) return 10
  const actualDiff = actualHome - actualAway
  const predDiff = predHome - predAway
  if (actualDiff === 0) return predDiff === 0 ? 5 : 0
  if (Math.sign(predDiff) === Math.sign(actualDiff)) {
    return predDiff === actualDiff ? 7 : 5
  }
  return 0
}

export function calculatePoints({
  predHome, predAway, predAdvancer,
  actualHome, actualAway, penaltyWinner,
  isKnockout,
}: {
  predHome: number; predAway: number; predAdvancer: Side | null
  actualHome: number; actualAway: number; penaltyWinner: Side | null
  isKnockout: boolean
}): number {
  const scale = calcScale({ predHome, predAway, actualHome, actualAway })
  if (!isKnockout) return scale

  const actualDiff = actualHome - actualAway
  const actualAdvancer: Side = actualDiff > 0 ? 'home' : actualDiff < 0 ? 'away' : (penaltyWinner ?? 'home')
  const rightAdvancer = predAdvancer === actualAdvancer

  const base = rightAdvancer ? Math.max(scale, 3) : scale

  const predDiff = predHome - predAway
  const predictedDraw = predDiff === 0
  const actualDraw = actualDiff === 0
  const penaltyBonus = actualDraw && predictedDraw && predAdvancer === penaltyWinner ? 3 : 0

  return base + penaltyBonus
}
```

- [ ] **Step 2: Verify scoring logic with test cases from the spec**

Create `lib/__tests__/scoring.test.ts`:

```typescript
import { calculatePoints } from '../scoring'

describe('group stage scoring', () => {
  test('exact score: 2-1 predicted 2-1 = 10', () => {
    expect(calculatePoints({ predHome:2, predAway:1, predAdvancer:null,
      actualHome:2, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(10)
  })
  test('correct GD: 2-1 predicted 3-2 = 7', () => {
    expect(calculatePoints({ predHome:3, predAway:2, predAdvancer:null,
      actualHome:2, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(7)
  })
  test('correct winner: 2-1 predicted 1-0 = 7 (GD both 1)', () => {
    expect(calculatePoints({ predHome:1, predAway:0, predAdvancer:null,
      actualHome:2, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(7)
  })
  test('correct winner wrong GD: 2-1 predicted 4-1 = 5', () => {
    expect(calculatePoints({ predHome:4, predAway:1, predAdvancer:null,
      actualHome:2, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(5)
  })
  test('wrong winner: 2-1 predicted 0-0 = 0', () => {
    expect(calculatePoints({ predHome:0, predAway:0, predAdvancer:null,
      actualHome:2, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(0)
  })
  test('wrong winner: 2-1 predicted 1-2 = 0', () => {
    expect(calculatePoints({ predHome:1, predAway:2, predAdvancer:null,
      actualHome:2, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(0)
  })
  test('actual draw exact: 1-1 predicted 1-1 = 10', () => {
    expect(calculatePoints({ predHome:1, predAway:1, predAdvancer:null,
      actualHome:1, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(10)
  })
  test('actual draw different score: 1-1 predicted 0-0 = 5', () => {
    expect(calculatePoints({ predHome:0, predAway:0, predAdvancer:null,
      actualHome:1, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(5)
  })
  test('actual draw different score: 1-1 predicted 2-2 = 5', () => {
    expect(calculatePoints({ predHome:2, predAway:2, predAdvancer:null,
      actualHome:1, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(5)
  })
  test('actual draw missed: 1-1 predicted 1-0 = 0', () => {
    expect(calculatePoints({ predHome:1, predAway:0, predAdvancer:null,
      actualHome:1, actualAway:1, penaltyWinner:null, isKnockout:false })).toBe(0)
  })
})

describe('knockout scoring (actual 1-1, HOME wins on pens)', () => {
  test('1-1 adv HOME = 10+3 = 13', () => {
    expect(calculatePoints({ predHome:1, predAway:1, predAdvancer:'home',
      actualHome:1, actualAway:1, penaltyWinner:'home', isKnockout:true })).toBe(13)
  })
  test('0-0 adv HOME = max(5,3)+3 = 8', () => {
    expect(calculatePoints({ predHome:0, predAway:0, predAdvancer:'home',
      actualHome:1, actualAway:1, penaltyWinner:'home', isKnockout:true })).toBe(8)
  })
  test('0-0 adv AWAY = 5 (no bonus)', () => {
    expect(calculatePoints({ predHome:0, predAway:0, predAdvancer:'away',
      actualHome:1, actualAway:1, penaltyWinner:'home', isKnockout:true })).toBe(5)
  })
  test('2-1 adv HOME = max(0,3) = 3', () => {
    expect(calculatePoints({ predHome:2, predAway:1, predAdvancer:'home',
      actualHome:1, actualAway:1, penaltyWinner:'home', isKnockout:true })).toBe(3)
  })
  test('2-1 adv AWAY = 0', () => {
    expect(calculatePoints({ predHome:2, predAway:1, predAdvancer:'away',
      actualHome:1, actualAway:1, penaltyWinner:'home', isKnockout:true })).toBe(0)
  })
})
```

- [ ] **Step 3: Install Jest and run tests**

```bash
npm install -D jest @types/jest ts-jest
```

Add to `package.json`:
```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/$1" }
},
"scripts": {
  "test": "jest"
}
```

Run: `npm test`
Expected: All 15 tests pass

- [ ] **Step 4: Create `components/ScoreInput.tsx`**

```typescript
'use client'
interface Props {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}

export function ScoreInput({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
        className="w-8 h-8 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors font-bold"
      >−</button>
      <span className="w-10 text-center tabular font-bold text-xl text-[var(--text)]">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        className="w-8 h-8 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30 transition-colors font-bold"
      >+</button>
    </div>
  )
}
```

- [ ] **Step 5: Create `components/AdvancerPicker.tsx`**

```typescript
'use client'
import type { Side } from '@/lib/types'

interface Props {
  homeTeam: string
  awayTeam: string
  homeCode: string | null
  awayCode: string | null
  value: Side | null
  onChange: (v: Side) => void
  disabled?: boolean
}

export function AdvancerPicker({ homeTeam, awayTeam, homeCode, awayCode, value, onChange, disabled }: Props) {
  return (
    <div className="mt-3">
      <p className="text-xs text-[var(--muted)] text-center mb-2 uppercase tracking-widest">¿Quién avanza?</p>
      <div className="flex gap-2">
        {(['home', 'away'] as Side[]).map(side => {
          const team = side === 'home' ? homeTeam : awayTeam
          const code = side === 'home' ? homeCode : awayCode
          const selected = value === side
          return (
            <button
              key={side}
              type="button"
              onClick={() => !disabled && onChange(side)}
              disabled={disabled}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${
                selected
                  ? 'border-[var(--green)] bg-[var(--green)]/10 text-[var(--green)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--muted)]'
              } disabled:opacity-40`}
            >
              {code && (
                <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
                  alt={team} className="w-5 h-4 object-cover rounded-sm" />
              )}
              <span className="text-sm font-medium truncate">{team}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create `components/LockBanner.tsx`**

```typescript
interface Props {
  locked: boolean
  label?: string
}

export function LockBanner({ locked, label }: Props) {
  if (!locked) return null
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
      locked ? 'bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/20' : ''
    }`}>
      <span>🔒</span>
      <span className="uppercase tracking-widest">{label ?? 'Cerrado'}</span>
    </div>
  )
}
```

- [ ] **Step 7: Create `components/MatchCard.tsx`**

```typescript
'use client'
import { useState } from 'react'
import type { Match, Prediction, PredictionScore, Side } from '@/lib/types'
import { ScoreInput } from './ScoreInput'
import { AdvancerPicker } from './AdvancerPicker'
import { createClient } from '@/lib/supabase/client'

interface Props {
  match: Match
  prediction: Prediction | null
  score: PredictionScore | null
  isOpen: boolean
  userId: string
}

export function MatchCard({ match, prediction: initialPred, score, isOpen, userId }: Props) {
  const [home, setHome] = useState(initialPred?.pred_home ?? 0)
  const [away, setAway] = useState(initialPred?.pred_away ?? 0)
  const [advancer, setAdvancer] = useState<Side | null>(initialPred?.pred_advancer ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function save() {
    if (!isOpen) return
    if (match.is_knockout && !advancer) return
    setSaving(true)
    await supabase.from('predictions').upsert({
      user_id: userId,
      match_id: match.id,
      pred_home: home,
      pred_away: away,
      pred_advancer: match.is_knockout ? advancer : null,
    }, { onConflict: 'user_id,match_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const pts = score?.points
  const pointsColor = pts === 10 ? 'text-[var(--gold)]' : pts === 7 ? 'text-[var(--green)]' : pts === 5 ? 'text-[var(--blue)]' : pts === 0 ? 'text-[var(--muted)]' : pts != null && pts >= 3 ? 'text-[var(--green)]' : 'text-[var(--muted)]'

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Teams header */}
      <div className="flex items-center px-4 py-3 gap-2 bg-[var(--surface-2)]">
        {match.home_code && (
          <img src={`https://flagcdn.com/w40/${match.home_code.toLowerCase()}.png`}
            alt={match.home_team} className="w-8 h-6 object-cover rounded-sm" />
        )}
        <span className="font-medium text-sm flex-1">{match.home_team}</span>
        <span className="text-xs text-[var(--muted)]">vs</span>
        <span className="font-medium text-sm flex-1 text-right">{match.away_team}</span>
        {match.away_code && (
          <img src={`https://flagcdn.com/w40/${match.away_code.toLowerCase()}.png`}
            alt={match.away_team} className="w-8 h-6 object-cover rounded-sm" />
        )}
      </div>

      {/* Prediction inputs */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-center gap-4">
          <ScoreInput value={home} onChange={setHome} disabled={!isOpen} />
          <span className="text-[var(--muted)] font-bold">—</span>
          <ScoreInput value={away} onChange={setAway} disabled={!isOpen} />
        </div>

        {match.is_knockout && (
          <AdvancerPicker
            homeTeam={match.home_team} awayTeam={match.away_team}
            homeCode={match.home_code} awayCode={match.away_code}
            value={advancer} onChange={setAdvancer} disabled={!isOpen}
          />
        )}

        {/* Result */}
        {match.home_score != null && match.away_score != null && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">
              Resultado: <strong className="text-[var(--text)]">{match.home_score} – {match.away_score}</strong>
              {match.penalty_winner && <span className="ml-1 text-xs">(pen.)</span>}
            </span>
            {pts != null && (
              <span className={`font-bold tabular ${pointsColor}`}>
                {pts > 0 ? `+${pts}` : '0'} pts
              </span>
            )}
          </div>
        )}

        {isOpen && (
          <button
            onClick={save}
            disabled={saving || (match.is_knockout && !advancer)}
            className={`mt-3 w-full py-2 rounded-lg text-sm font-bold transition-all ${
              saved
                ? 'bg-[var(--green)]/20 text-[var(--green)] border border-[var(--green)]/30'
                : 'bg-[var(--gold)] text-[var(--bg)] hover:bg-[var(--gold-2)] disabled:opacity-40'
            }`}
          >
            {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar'}
          </button>
        )}

        {!isOpen && (
          <p className="mt-2 text-center text-xs text-[var(--muted)] uppercase tracking-widest">
            🔒 Cerrado
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add lib/scoring.ts lib/__tests__/ components/ScoreInput.tsx components/AdvancerPicker.tsx components/LockBanner.tsx components/MatchCard.tsx
git commit -m "feat: add scoring logic with tests and core prediction components"
```

---

### Task 5: Predict Page

**Files:**
- Create: `app/predict/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (server), `Match`, `Prediction`, `PredictionScore`, `MatchCard`
- Produces: predict page showing all matches grouped by stage

- [ ] **Step 1: Create `app/predict/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MatchCard } from '@/components/MatchCard'
import type { Match, Prediction, PredictionScore } from '@/lib/types'

const STAGE_LABELS: Record<string, string> = {
  group: 'Fase de Grupos',
  round_of_32: 'Ronda de 32',
  round_of_16: 'Octavos de Final',
  quarter: 'Cuartos de Final',
  semi: 'Semifinales',
  third_place: 'Tercer Puesto',
  final: 'Final',
}

const STAGE_ORDER = ['group','round_of_32','round_of_16','quarter','semi','third_place','final']

export default async function PredictPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: matches }, { data: predictions }, { data: scores }] = await Promise.all([
    supabase.from('matches').select('*').order('kickoff_at'),
    supabase.from('predictions').select('*').eq('user_id', user.id),
    supabase.from('prediction_scores').select('*').eq('user_id', user.id),
  ])

  const predMap = new Map((predictions ?? []).map(p => [p.match_id, p]))
  const scoreMap = new Map((scores ?? []).map(s => [s.match_id, s]))

  // Group by stage
  const byStage = new Map<string, Match[]>()
  for (const m of (matches ?? [])) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

  const now = new Date().toISOString()

  function isOpen(match: Match): boolean {
    if (match.force_open) return true
    if (match.predictions_locked) return false
    if (match.kickoff_at <= now) return false
    return true
  }

  return (
    <div className="py-6 space-y-8">
      <h1 className="font-display text-3xl">
        <span className="text-[var(--muted)]">MI</span>{' '}
        <span className="text-[var(--gold)]">PRODE</span>
      </h1>

      {STAGE_ORDER.filter(s => byStage.has(s)).map(stage => (
        <section key={stage}>
          <h2 className="font-display text-xl text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
            {STAGE_LABELS[stage] ?? stage}
          </h2>
          <div className="space-y-3">
            {byStage.get(stage)!.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predMap.get(match.id) ?? null}
                score={scoreMap.get(match.id) as PredictionScore ?? null}
                isOpen={isOpen(match)}
                userId={user.id}
              />
            ))}
          </div>
        </section>
      ))}

      {(matches ?? []).length === 0 && (
        <p className="text-[var(--muted)] text-center py-12">
          No hay partidos cargados aún.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/predict/
git commit -m "feat: add predict page with match cards by stage"
```

---

### Task 6: Champion Page

**Files:**
- Create: `components/ChampionPicker.tsx`
- Create: `app/champion/page.tsx`

**Interfaces:**
- Consumes: `TournamentBonus`, `BonusPrediction`, Supabase `tournament_bonuses` + `bonus_predictions`
- Produces: champion pick UI

- [ ] **Step 1: Create `app/champion/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChampionPicker } from '@/components/ChampionPicker'

export default async function ChampionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: bonus }, { data: pick }] = await Promise.all([
    supabase.from('tournament_bonuses').select('*').eq('key', 'champion').single(),
    supabase.from('bonus_predictions').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  const now = new Date().toISOString()
  const isLocked = bonus?.locked || (bonus?.lock_at != null && now >= bonus.lock_at)

  return (
    <div className="py-6">
      <h1 className="font-display text-3xl mb-1">
        <span className="text-[var(--muted)]">CAMPEÓN</span>{' '}
        <span className="text-[var(--gold)]">MUNDIAL</span>
      </h1>
      {bonus && (
        <p className="text-[var(--muted)] text-sm mb-6">
          {bonus.points > 0 ? `Vale ${bonus.points} puntos` : 'Sin puntos por ahora'}
          {bonus.lock_at && !isLocked && (
            <span className="ml-2">· Cierra {new Date(bonus.lock_at).toLocaleDateString('es', { day: 'numeric', month: 'long' })}</span>
          )}
        </p>
      )}
      {bonus ? (
        <ChampionPicker
          bonus={bonus}
          currentAnswer={pick?.answer ?? null}
          userId={user.id}
          isLocked={isLocked}
        />
      ) : (
        <p className="text-[var(--muted)]">No disponible aún.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/ChampionPicker.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TournamentBonus } from '@/lib/types'

const WORLD_CUP_2026_TEAMS = [
  'Argentina','Brasil','Francia','Inglaterra','España','Alemania',
  'Portugal','Países Bajos','Bélgica','Uruguay','Colombia','México',
  'Estados Unidos','Canadá','Marruecos','Senegal','Japón','Corea del Sur',
  'Australia','Croacia','Serbia','Suiza','Dinamarca','Polonia',
  'Ecuador','Perú','Chile','Venezuela','Bolivia','Paraguay',
  'Costa Rica','Panamá','Jamaica','Honduras','El Salvador','Guatemala',
  'Qatar','Arabia Saudita','Irán','Irak','Siria','Jordania',
  'Ghana','Nigeria','Costa de Marfil','Camerún','Egipto','Argelia',
  'Nueva Zelanda','Fiyi','Tahití',
]

interface Props {
  bonus: TournamentBonus
  currentAnswer: string | null
  userId: string
  isLocked: boolean
}

export function ChampionPicker({ bonus, currentAnswer, userId, isLocked }: Props) {
  const [answer, setAnswer] = useState(currentAnswer ?? '')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const filtered = WORLD_CUP_2026_TEAMS.filter(t =>
    t.toLowerCase().includes(search.toLowerCase())
  )

  async function save(team: string) {
    if (isLocked) return
    setAnswer(team)
    setSaving(true)
    await supabase.from('bonus_predictions').upsert({
      user_id: userId,
      bonus_id: bonus.id,
      answer: team,
    }, { onConflict: 'user_id,bonus_id' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (isLocked) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--red)]/30 rounded-xl p-6 text-center">
        <p className="text-[var(--red)] text-sm uppercase tracking-widest mb-2">🔒 Cerrado</p>
        {answer && (
          <p className="text-[var(--text)]">Tu elección: <strong className="text-[var(--gold)]">{answer}</strong></p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {answer && (
        <div className="bg-[var(--surface)] border border-[var(--green)]/30 rounded-xl p-4 text-center">
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest mb-1">Tu elección actual</p>
          <p className="text-lg font-bold text-[var(--green)]">{answer}</p>
          {saved && <p className="text-xs text-[var(--green)] mt-1">✓ Guardado</p>}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar selección…"
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)]"
      />
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filtered.map(team => (
          <button
            key={team}
            onClick={() => save(team)}
            disabled={saving}
            className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
              answer === team
                ? 'border-[var(--green)] bg-[var(--green)]/10 text-[var(--green)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--muted)]'
            }`}
          >
            {team}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/champion/ components/ChampionPicker.tsx
git commit -m "feat: add champion pick page with team search"
```

---

### Task 7: Ranking + Match Detail

**Files:**
- Create: `components/ColorAvatar.tsx`
- Create: `components/RankBadge.tsx`
- Create: `components/LeaderboardTable.tsx`
- Create: `app/ranking/page.tsx`
- Create: `app/match/[id]/page.tsx`

**Interfaces:**
- Consumes: `leaderboard` view, `prediction_scores` view, `createClient()` (server)
- Produces: global leaderboard page, per-match reveal page

- [ ] **Step 1: Create `components/ColorAvatar.tsx`**

```typescript
const COLORS = ['#f5c542','#34d399','#4c8dff','#f87171','#a78bfa','#fb923c','#38bdf8']

export function ColorAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const color = COLORS[name.charCodeAt(0) % COLORS.length]
  const initial = name.charAt(0).toUpperCase()
  return (
    <div
      style={{ width: size, height: size, backgroundColor: color + '33', border: `2px solid ${color}` }}
      className="rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0"
    >
      <span style={{ color }}>{initial}</span>
    </div>
  )
}
```

- [ ] **Step 2: Create `components/RankBadge.tsx`**

```typescript
export function RankBadge({ rank }: { rank: number }) {
  const style =
    rank === 1 ? 'bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]/40' :
    rank === 2 ? 'bg-[var(--muted)]/20 text-[var(--muted)] border-[var(--muted)]/40' :
    rank === 3 ? 'bg-[#cd7f32]/20 text-[#cd7f32] border-[#cd7f32]/40' :
    'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]'
  return (
    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold tabular ${style}`}>
      {rank}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/LeaderboardTable.tsx`**

```typescript
import type { LeaderboardRow } from '@/lib/types'
import { RankBadge } from './RankBadge'
import { ColorAvatar } from './ColorAvatar'

interface Props {
  rows: LeaderboardRow[]
  currentUserId: string
}

export function LeaderboardTable({ rows, currentUserId }: Props) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const isMe = row.user_id === currentUserId
        return (
          <div
            key={row.user_id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
              isMe
                ? 'border-[var(--green)]/40 bg-[var(--green)]/5'
                : 'border-[var(--border)] bg-[var(--surface)]'
            }`}
          >
            <RankBadge rank={i + 1} />
            <ColorAvatar name={row.display_name} />
            <div className="flex-1 min-w-0">
              <p className={`font-medium truncate ${isMe ? 'text-[var(--green)]' : 'text-[var(--text)]'}`}>
                {row.display_name}
                {isMe && <span className="ml-2 text-xs text-[var(--green)] opacity-70">tú</span>}
              </p>
              <p className="text-xs text-[var(--muted)]">{row.exact_hits} exactos</p>
            </div>
            <span className={`font-bold tabular text-lg ${isMe ? 'text-[var(--green)]' : 'text-[var(--gold)]'}`}>
              {row.total_points}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Create `app/ranking/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeaderboardTable } from '@/components/LeaderboardTable'

export default async function RankingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase.from('leaderboard').select('*')

  return (
    <div className="py-6">
      <h1 className="font-display text-3xl mb-6">
        <span className="text-[var(--muted)]">RANKING</span>{' '}
        <span className="text-[var(--gold)]">GLOBAL</span>
      </h1>
      {rows && rows.length > 0 ? (
        <LeaderboardTable rows={rows} currentUserId={user.id} />
      ) : (
        <p className="text-[var(--muted)] text-center py-12">Aún no hay puntos.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `app/match/[id]/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ColorAvatar } from '@/components/ColorAvatar'
import type { Side } from '@/lib/types'

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: match }, { data: scores }] = await Promise.all([
    supabase.from('matches').select('*').eq('id', id).single(),
    supabase.from('prediction_scores').select('*').eq('match_id', id).order('points', { ascending: false }),
  ])

  if (!match) notFound()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', (scores ?? []).map(s => s.user_id))

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const pointsColor = (pts: number | null) =>
    pts === 10 ? 'text-[var(--gold)]' :
    pts === 7 ? 'text-[var(--green)]' :
    pts === 5 ? 'text-[var(--blue)]' :
    pts != null && pts >= 3 ? 'text-[var(--green)]' :
    'text-[var(--muted)]'

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        {match.home_code && (
          <img src={`https://flagcdn.com/w40/${match.home_code.toLowerCase()}.png`}
            alt={match.home_team} className="w-10 h-7 object-cover rounded" />
        )}
        <div>
          <h1 className="font-display text-2xl">
            {match.home_team} <span className="text-[var(--muted)]">vs</span> {match.away_team}
          </h1>
          {match.home_score != null && (
            <p className="text-[var(--muted)] text-sm">
              Resultado: <strong className="text-[var(--text)]">{match.home_score} – {match.away_score}</strong>
            </p>
          )}
        </div>
        {match.away_code && (
          <img src={`https://flagcdn.com/w40/${match.away_code.toLowerCase()}.png`}
            alt={match.away_team} className="w-10 h-7 object-cover rounded ml-auto" />
        )}
      </div>

      <div className="space-y-2">
        {(scores ?? []).map(s => {
          const profile = profileMap.get(s.user_id)
          const pts = s.points
          return (
            <div key={s.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
              s.user_id === user.id
                ? 'border-[var(--green)]/40 bg-[var(--green)]/5'
                : 'border-[var(--border)] bg-[var(--surface)]'
            }`}>
              <ColorAvatar name={profile?.display_name ?? '?'} />
              <div className="flex-1">
                <p className="text-sm font-medium">{profile?.display_name ?? 'Usuario'}</p>
                <p className="text-xs text-[var(--muted)] tabular">
                  {s.pred_home} – {s.pred_away}
                  {s.pred_advancer && <span className="ml-1">· avanza {s.pred_advancer === 'home' ? match.home_team : match.away_team}</span>}
                </p>
              </div>
              {pts != null && (
                <span className={`font-bold tabular text-lg ${pointsColor(pts)}`}>
                  {pts > 0 ? `+${pts}` : '0'}
                </span>
              )}
            </div>
          )
        })}
        {(scores ?? []).length === 0 && (
          <p className="text-[var(--muted)] text-center py-8 text-sm">
            Los pronósticos se revelan cuando el partido cierra.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add components/ColorAvatar.tsx components/RankBadge.tsx components/LeaderboardTable.tsx app/ranking/ app/match/
git commit -m "feat: add global ranking page and match detail with revealed picks"
```

---

### Task 8: Groups

**Files:**
- Create: `components/CreateGroupForm.tsx`
- Create: `components/JoinGroupBox.tsx`
- Create: `components/ShareButton.tsx`
- Create: `app/groups/page.tsx`
- Create: `app/groups/[id]/page.tsx`
- Create: `app/join/[code]/page.tsx`

**Interfaces:**
- Consumes: `create_group()`, `join_group()`, `group_leaderboard()` RPCs
- Produces: groups list, group detail, share link handler

- [ ] **Step 1: Create `components/CreateGroupForm.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function CreateGroupForm() {
  const [name, setName] = useState('')
  const [region, setRegion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.rpc('create_group', {
      p_name: name,
      p_region: region || undefined,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push(`/groups/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nombre del grupo"
        required
        maxLength={40}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)]"
      />
      <input
        value={region}
        onChange={e => setRegion(e.target.value)}
        placeholder="Subtítulo (ej: Oficina, Familia)"
        maxLength={40}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)]"
      />
      {error && <p className="text-[var(--red)] text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--gold)] text-[var(--bg)] font-bold py-3 rounded-lg hover:bg-[var(--gold-2)] disabled:opacity-50"
      >
        {loading ? 'Creando…' : 'Crear Grupo'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create `components/JoinGroupBox.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function JoinGroupBox() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.rpc('join_group', { p_code: code.trim() })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push(`/groups/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={code}
        onChange={e => setCode(e.target.value)}
        placeholder="Código del grupo"
        required
        className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)] uppercase"
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-medium px-5 py-3 rounded-lg hover:border-[var(--gold)] disabled:opacity-50"
      >
        {loading ? '…' : 'Unirse'}
      </button>
      {error && <p className="text-[var(--red)] text-sm mt-1 w-full">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 3: Create `components/ShareButton.tsx`**

```typescript
'use client'
interface Props { code: string }

export function ShareButton({ code }: Props) {
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${code}`

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: 'Unirse a mi prode', url })
    } else {
      await navigator.clipboard.writeText(url)
      alert('¡Link copiado!')
    }
  }

  return (
    <button
      onClick={share}
      className="w-full py-3 rounded-xl font-bold text-[var(--bg)] text-sm uppercase tracking-widest"
      style={{ background: 'linear-gradient(90deg, var(--gold) 0%, var(--gold-2) 100%)' }}
    >
      Compartir
    </button>
  )
}
```

- [ ] **Step 4: Create `app/groups/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CreateGroupForm } from '@/components/CreateGroupForm'
import { JoinGroupBox } from '@/components/JoinGroupBox'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)

  const groupIds = (memberships ?? []).map(m => m.group_id)
  const { data: groups } = groupIds.length > 0
    ? await supabase.from('groups').select('*').in('id', groupIds)
    : { data: [] }

  return (
    <div className="py-6 space-y-8">
      <h1 className="font-display text-3xl">
        <span className="text-[var(--muted)]">MIS</span>{' '}
        <span className="text-[var(--gold)]">GRUPOS</span>
      </h1>

      {/* My groups */}
      {(groups ?? []).length > 0 ? (
        <div className="space-y-2">
          {(groups ?? []).map(g => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)]/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/20 flex items-center justify-center font-display text-lg text-[var(--gold)]">
                {g.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{g.name}</p>
                {g.region && <p className="text-xs text-[var(--muted)] truncate">{g.region}</p>}
              </div>
              <p className="text-xs text-[var(--muted)] font-mono">{g.invite_code}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[var(--muted)] text-sm">Todavía no estás en ningún grupo.</p>
      )}

      {/* Join */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="font-display text-xl mb-4 text-[var(--text)]">Unirse con código</h2>
        <JoinGroupBox />
      </div>

      {/* Create */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="font-display text-xl mb-4 text-[var(--text)]">Crear grupo</h2>
        <CreateGroupForm />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `app/groups/[id]/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LeaderboardTable } from '@/components/LeaderboardTable'
import { ShareButton } from '@/components/ShareButton'

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: group }, { data: rows }] = await Promise.all([
    supabase.from('groups').select('*').eq('id', id).single(),
    supabase.rpc('group_leaderboard', { p_group: id }),
  ])

  if (!group) notFound()

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--gold)]">{group.name.toUpperCase()}</h1>
        {group.region && <p className="text-[var(--muted)] text-sm mt-1">{group.region}</p>}
        <p className="text-xs text-[var(--muted)] mt-1 font-mono">{group.invite_code}</p>
      </div>

      <ShareButton code={group.invite_code} />

      {rows && rows.length > 0 ? (
        <LeaderboardTable rows={rows} currentUserId={user.id} />
      ) : (
        <p className="text-[var(--muted)] text-center py-8 text-sm">Aún no hay puntos en este grupo.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create `app/join/[code]/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login`)

  const { data: group, error } = await supabase.rpc('join_group', { p_code: code })
  if (error || !group) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--red)]">Grupo no encontrado o lleno.</p>
      </div>
    )
  }

  redirect(`/groups/${group.id}`)
}
```

- [ ] **Step 7: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add components/CreateGroupForm.tsx components/JoinGroupBox.tsx components/ShareButton.tsx app/groups/ app/join/
git commit -m "feat: add groups with create, join, share link, and group leaderboard"
```

---

### Task 9: Dashboard

**Files:**
- Create: `components/StatTile.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `leaderboard` view, `matches`, `predictions`, `createClient()` (server)
- Produces: dashboard with rank, stats tiles, next matches

- [ ] **Step 1: Create `components/StatTile.tsx`**

```typescript
interface Props {
  label: string
  value: string | number
  sub?: string
}

export function StatTile({ label, value, sub }: Props) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-[var(--muted)] uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-bold tabular text-[var(--text)]">{value}</p>
      {sub && <p className="text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StatTile } from '@/components/StatTile'
import type { Match } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()

  const [{ data: myRow }, { data: nextMatches }, { data: myPreds }] = await Promise.all([
    supabase.from('leaderboard').select('*').eq('user_id', user.id).single(),
    supabase.from('matches').select('*').gt('kickoff_at', now).order('kickoff_at').limit(5),
    supabase.from('predictions').select('match_id').eq('user_id', user.id),
  ])

  const { data: allRows } = await supabase.from('leaderboard').select('user_id')
  const rank = (allRows ?? []).findIndex(r => r.user_id === user.id) + 1
  const predMatchIds = new Set((myPreds ?? []).map(p => p.match_id))

  return (
    <div className="py-6 space-y-8">
      <div>
        <p className="text-[var(--muted)] text-sm">Bienvenido,</p>
        <h1 className="font-display text-4xl text-[var(--gold)]">{user.email?.split('@')[0].toUpperCase()}</h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Puntos" value={myRow?.total_points ?? 0} />
        <StatTile label="Posición" value={rank > 0 ? `#${rank}` : '–'} />
        <StatTile label="Exactos" value={myRow?.exact_hits ?? 0} />
      </div>

      {(nextMatches ?? []).length > 0 && (
        <section>
          <h2 className="font-display text-xl text-[var(--text)] mb-3">PRÓXIMOS PARTIDOS</h2>
          <div className="space-y-2">
            {(nextMatches ?? []).map((m: Match) => {
              const hasPred = predMatchIds.has(m.id)
              return (
                <Link
                  key={m.id}
                  href="/predict"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)]/40 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {m.home_code && (
                      <img src={`https://flagcdn.com/w40/${m.home_code.toLowerCase()}.png`}
                        alt={m.home_team} className="w-6 h-4 object-cover rounded-sm" />
                    )}
                    <span className="text-sm font-medium truncate">{m.home_team} vs {m.away_team}</span>
                    {m.away_code && (
                      <img src={`https://flagcdn.com/w40/${m.away_code.toLowerCase()}.png`}
                        alt={m.away_team} className="w-6 h-4 object-cover rounded-sm" />
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    hasPred ? 'bg-[var(--green)]/20 text-[var(--green)]' : 'bg-[var(--red)]/20 text-[var(--red)]'
                  }`}>
                    {hasPred ? '✓ Listo' : 'Pendiente'}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/predict" className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center hover:border-[var(--gold)]/40 transition-colors">
          <p className="font-display text-lg text-[var(--gold)]">PREDECIR</p>
          <p className="text-xs text-[var(--muted)] mt-1">Completar pronósticos</p>
        </Link>
        <Link href="/ranking" className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center hover:border-[var(--gold)]/40 transition-colors">
          <p className="font-display text-lg text-[var(--gold)]">RANKING</p>
          <p className="text-xs text-[var(--muted)] mt-1">Ver tabla global</p>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/StatTile.tsx app/page.tsx
git commit -m "feat: add dashboard with stats tiles and next matches"
```

---

### Task 10: Admin Page

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/AdminClient.tsx`

**Interfaces:**
- Consumes: all tables via admin-only Supabase policies
- Produces: full admin UI for results, locking, phase deadlines, champion, admin management

- [ ] **Step 1: Create `app/admin/AdminClient.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Match, PhaseDeadline, TournamentBonus, Profile } from '@/lib/types'

interface Props {
  matches: Match[]
  deadlines: PhaseDeadline[]
  champion: TournamentBonus | null
  profiles: Profile[]
  currentUserId: string
}

export function AdminClient({ matches: initMatches, deadlines: initDeadlines, champion: initChampion, profiles: initProfiles, currentUserId }: Props) {
  const [matches, setMatches] = useState(initMatches)
  const [deadlines, setDeadlines] = useState(initDeadlines)
  const [champion, setChampion] = useState(initChampion)
  const [profiles, setProfiles] = useState(initProfiles)
  const [tab, setTab] = useState<'results'|'locks'|'deadlines'|'champion'|'admins'>('results')
  const [saving, setSaving] = useState<string | null>(null)
  const supabase = createClient()

  async function updateMatch(id: string, updates: Partial<Match>) {
    setSaving(id)
    await supabase.from('matches').update(updates).eq('id', id)
    setMatches(ms => ms.map(m => m.id === id ? { ...m, ...updates } : m))
    setSaving(null)
  }

  async function updateDeadline(stage: string, lock_at: string) {
    setSaving(stage)
    await supabase.from('phase_deadlines').update({ lock_at }).eq('stage', stage)
    setDeadlines(ds => ds.map(d => d.stage === stage ? { ...d, lock_at } : d))
    setSaving(null)
  }

  async function updateChampion(updates: Partial<TournamentBonus>) {
    if (!champion) return
    setSaving('champion')
    await supabase.from('tournament_bonuses').update(updates).eq('id', champion.id)
    setChampion(c => c ? { ...c, ...updates } : c)
    setSaving(null)
  }

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    setSaving(userId)
    await supabase.from('profiles').update({ is_admin: isAdmin }).eq('id', userId)
    setProfiles(ps => ps.map(p => p.id === userId ? { ...p, is_admin: isAdmin } : p))
    setSaving(null)
  }

  const tabs = [
    { key: 'results', label: 'Resultados' },
    { key: 'locks', label: 'Bloqueos' },
    { key: 'deadlines', label: 'Fechas' },
    { key: 'champion', label: 'Campeón' },
    { key: 'admins', label: 'Admins' },
  ] as const

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--gold)] text-[var(--bg)]'
                : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Results tab */}
      {tab === 'results' && (
        <div className="space-y-3">
          {matches.map(m => (
            <div key={m.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <p className="font-medium text-sm mb-3">{m.home_team} vs {m.away_team}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0}
                    defaultValue={m.home_score ?? ''}
                    placeholder="Local"
                    className="w-16 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-center text-sm tabular"
                    onBlur={e => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v)) updateMatch(m.id, { home_score: v })
                    }}
                  />
                  <span className="text-[var(--muted)]">–</span>
                  <input
                    type="number" min={0}
                    defaultValue={m.away_score ?? ''}
                    placeholder="Visitante"
                    className="w-16 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-center text-sm tabular"
                    onBlur={e => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v)) updateMatch(m.id, { away_score: v })
                    }}
                  />
                </div>
                {m.is_knockout && (
                  <select
                    defaultValue={m.penalty_winner ?? ''}
                    onChange={e => updateMatch(m.id, { penalty_winner: (e.target.value as 'home'|'away') || null })}
                    className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-sm"
                  >
                    <option value="">Sin penales</option>
                    <option value="home">Penales: {m.home_team}</option>
                    <option value="away">Penales: {m.away_team}</option>
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={m.result_final}
                    onChange={e => updateMatch(m.id, { result_final: e.target.checked })}
                    className="accent-[var(--gold)]"
                  />
                  <span className="text-[var(--muted)]">Final</span>
                </label>
                {saving === m.id && <span className="text-xs text-[var(--muted)]">Guardando…</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Locks tab */}
      {tab === 'locks' && (
        <div className="space-y-3">
          {matches.map(m => (
            <div key={m.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 flex-wrap">
              <p className="font-medium text-sm flex-1 min-w-0 truncate">{m.home_team} vs {m.away_team}</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={m.predictions_locked}
                  onChange={e => updateMatch(m.id, { predictions_locked: e.target.checked })}
                  className="accent-[var(--red)]"
                />
                <span className="text-[var(--red)]">Cerrar</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={m.force_open}
                  onChange={e => updateMatch(m.id, { force_open: e.target.checked })}
                  className="accent-[var(--green)]"
                />
                <span className="text-[var(--green)]">Forzar abierto</span>
              </label>
              {saving === m.id && <span className="text-xs text-[var(--muted)]">…</span>}
            </div>
          ))}
        </div>
      )}

      {/* Deadlines tab */}
      {tab === 'deadlines' && (
        <div className="space-y-3">
          {deadlines.map(d => (
            <div key={d.stage} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4">
              <p className="font-medium text-sm w-32 flex-shrink-0">{d.stage}</p>
              <input
                type="datetime-local"
                defaultValue={d.lock_at.slice(0, 16)}
                onBlur={e => updateDeadline(d.stage, new Date(e.target.value).toISOString())}
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm"
              />
              {saving === d.stage && <span className="text-xs text-[var(--muted)]">…</span>}
            </div>
          ))}
        </div>
      )}

      {/* Champion tab */}
      {tab === 'champion' && champion && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-[var(--muted)] mb-1">Respuesta correcta</p>
              <input
                type="text"
                defaultValue={champion.correct_answer ?? ''}
                placeholder="Equipo campeón…"
                onBlur={e => updateChampion({ correct_answer: e.target.value || null })}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="text-sm text-[var(--muted)] mb-1">Puntos</p>
              <input
                type="number" min={0}
                defaultValue={champion.points}
                onBlur={e => updateChampion({ points: parseInt(e.target.value) || 0 })}
                className="w-20 bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm tabular text-center"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={champion.locked}
              onChange={e => updateChampion({ locked: e.target.checked })}
              className="accent-[var(--red)]"
            />
            <span>Cerrar pronóstico de campeón</span>
          </label>
          {saving === 'champion' && <span className="text-xs text-[var(--muted)]">Guardando…</span>}
        </div>
      )}

      {/* Admins tab */}
      {tab === 'admins' && (
        <div className="space-y-2">
          {profiles.map(p => (
            <div key={p.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.display_name}</p>
              </div>
              {p.id === currentUserId ? (
                <span className="text-xs text-[var(--gold)] px-2 py-1 border border-[var(--gold)]/30 rounded">Tú</span>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.is_admin}
                    onChange={e => toggleAdmin(p.id, e.target.checked)}
                    className="accent-[var(--gold)]"
                  />
                  <span className="text-[var(--muted)]">Admin</span>
                </label>
              )}
              {saving === p.id && <span className="text-xs text-[var(--muted)]">…</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/admin/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminClient } from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: matches }, { data: deadlines }, { data: champion }, { data: profiles }] = await Promise.all([
    supabase.from('matches').select('*').order('kickoff_at'),
    supabase.from('phase_deadlines').select('*'),
    supabase.from('tournament_bonuses').select('*').eq('key', 'champion').single(),
    supabase.from('profiles').select('*').order('display_name'),
  ])

  return (
    <div className="py-6 space-y-6">
      <h1 className="font-display text-3xl">
        <span className="text-[var(--red)]">ADMIN</span>
      </h1>
      <AdminClient
        matches={matches ?? []}
        deadlines={deadlines ?? []}
        champion={champion}
        profiles={profiles ?? []}
        currentUserId={user.id}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/admin/
git commit -m "feat: add admin page with results, locks, deadlines, champion, and admin management"
```

---

### Task 11: PWA + Polish

**Files:**
- Create: `public/manifest.json`
- Modify: `app/layout.tsx` (add viewport + manifest link)

**Interfaces:**
- Produces: installable PWA

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "Prode Mundial 2026",
  "short_name": "Prode 2026",
  "description": "Pronósticos del Mundial 2026",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0e17",
  "theme_color": "#0a0e17",
  "icons": [
    { "src": "/favicon.ico", "sizes": "48x48", "type": "image/x-icon" }
  ]
}
```

- [ ] **Step 2: Verify full build**

Run: `npm run build`
Expected: build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add public/manifest.json
git commit -m "feat: add PWA manifest"
```

---

## Supabase Setup (Manual — Run in Dashboard SQL Editor)

Before testing any feature, run the full SQL from `PRODE_BUILD_PLAN.md` §5 in the Supabase SQL Editor at:
`https://supabase.com/dashboard/project/dltgbifqdwnynimhiguf/sql/new`

Then seed test data:
```sql
-- One group match
insert into matches (stage, match_no, home_team, away_team, home_code, away_code, kickoff_at, is_knockout)
values ('group', 1, 'Argentina', 'Francia', 'ar', 'fr', now() + interval '2 hours', false);

-- One knockout match
insert into matches (stage, match_no, home_team, away_team, home_code, away_code, kickoff_at, is_knockout)
values ('round_of_16', 1, 'Brasil', 'España', 'br', 'es', now() + interval '48 hours', true);
```

Make yourself admin (replace with your UUID from auth.users):
```sql
update profiles set is_admin = true where id = 'YOUR_UUID_HERE';
```
