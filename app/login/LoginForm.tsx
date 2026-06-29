'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 text-center">
        <p className="text-[var(--green)] font-medium mb-2">Email sent!</p>
        <p className="text-[var(--muted)] text-sm">
          Check your inbox at <strong className="text-[var(--text)]">{email}</strong> and click the link to sign in.
        </p>
        <button
          onClick={() => { setSent(false); setEmail('') }}
          className="mt-4 text-xs text-[var(--gold)] hover:underline"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          autoFocus
          className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
        />
        {error && <p className="text-[var(--red)] text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--gold)] text-[var(--bg)] font-bold py-3 rounded-lg hover:bg-[var(--gold-2)] transition-colors disabled:opacity-50"
        >
          {loading ? '…' : 'Send magic link'}
        </button>
      </form>
      <p className="text-center text-xs text-[var(--muted)]">
        We&apos;ll email you a sign-in link — no password needed.
      </p>
    </div>
  )
}
