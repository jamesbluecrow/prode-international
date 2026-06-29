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
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Group code"
          required
          className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)] uppercase tracking-wider"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-medium px-5 py-3 rounded-lg hover:border-[var(--gold)] disabled:opacity-50 transition-colors"
        >
          {loading ? '…' : 'Join'}
        </button>
      </div>
      {error && <p className="text-[var(--red)] text-sm">{error}</p>}
    </form>
  )
}
