'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'signin' | 'signup' | 'magic' | 'reset'

const inputCls = 'w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)] transition-colors'
const btnCls = 'w-full bg-[var(--gold)] text-[var(--bg)] font-bold py-3 rounded-lg hover:bg-[var(--gold-2)] transition-colors disabled:opacity-50'

export function LoginForm() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const supabase = createClient()
  const router = useRouter()

  function reset(next: Mode) {
    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
    setConfirm('')
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push('/')
    router.refresh()
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setInfo('Account created! Check your inbox to confirm your email, then sign in.')
    reset('signin')
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setInfo(`Magic link sent to ${email} — check your inbox.`)
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/account/set-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setInfo(`Password reset email sent to ${email}.`)
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
      {info && (
        <p className="text-[var(--green)] text-sm text-center bg-[var(--green)]/10 border border-[var(--green)]/20 rounded-lg px-3 py-2">
          {info}
        </p>
      )}

      {/* Sign in */}
      {mode === 'signin' && (
        <>
          <form onSubmit={handleSignIn} className="space-y-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required autoFocus className={inputCls} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" required className={inputCls} />
            {error && <p className="text-[var(--red)] text-sm">{error}</p>}
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? '…' : 'Sign in'}
            </button>
          </form>
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <button onClick={() => reset('reset')} className="hover:text-[var(--text)] transition-colors">
              Forgot password?
            </button>
            <button onClick={() => reset('signup')} className="hover:text-[var(--gold)] transition-colors">
              Create account →
            </button>
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            <button onClick={() => reset('magic')}
              className="w-full text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors py-1">
              Sign in with magic link instead
            </button>
          </div>
        </>
      )}

      {/* Sign up */}
      {mode === 'signup' && (
        <>
          <p className="text-xs text-[var(--muted)] text-center uppercase tracking-widest">Create account</p>
          <form onSubmit={handleSignUp} className="space-y-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required autoFocus className={inputCls} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password (min 8 characters)" required minLength={8} className={inputCls} />
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm password" required className={inputCls} />
            {error && <p className="text-[var(--red)] text-sm">{error}</p>}
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? '…' : 'Create account'}
            </button>
          </form>
          <button onClick={() => reset('signin')}
            className="w-full text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            ← Back to sign in
          </button>
        </>
      )}

      {/* Magic link */}
      {mode === 'magic' && (
        <>
          <p className="text-xs text-[var(--muted)] text-center uppercase tracking-widest">Magic link</p>
          <form onSubmit={handleMagicLink} className="space-y-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required autoFocus className={inputCls} />
            {error && <p className="text-[var(--red)] text-sm">{error}</p>}
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? '…' : 'Send magic link'}
            </button>
          </form>
          <p className="text-center text-xs text-[var(--muted)]">No password needed — we&apos;ll email you a sign-in link.</p>
          <button onClick={() => reset('signin')}
            className="w-full text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            ← Back to sign in
          </button>
        </>
      )}

      {/* Reset password */}
      {mode === 'reset' && (
        <>
          <p className="text-xs text-[var(--muted)] text-center uppercase tracking-widest">Reset password</p>
          <form onSubmit={handleReset} className="space-y-3">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required autoFocus className={inputCls} />
            {error && <p className="text-[var(--red)] text-sm">{error}</p>}
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? '…' : 'Send reset email'}
            </button>
          </form>
          <button onClick={() => reset('signin')}
            className="w-full text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            ← Back to sign in
          </button>
        </>
      )}
    </div>
  )
}
