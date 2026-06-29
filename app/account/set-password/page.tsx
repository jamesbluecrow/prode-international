'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => router.push('/'), 2000)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 text-center">
          <p className="text-[var(--green)] font-medium mb-2">Password updated!</p>
          <p className="text-[var(--muted)] text-sm">Redirecting…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-center mb-2">
          <span className="text-[var(--muted)]">SET</span>{' '}
          <span className="text-[var(--gold)]">PASSWORD</span>
        </h1>
        <p className="text-center text-[var(--muted)] text-sm mb-8">Choose a new password</p>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              required
              minLength={8}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
            />
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              required
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)] transition-colors"
            />
            {error && <p className="text-[var(--red)] text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--gold)] text-[var(--bg)] font-bold py-3 rounded-lg hover:bg-[var(--gold-2)] transition-colors disabled:opacity-50"
            >
              {loading ? '…' : 'Set password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
