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
        placeholder="Group name"
        required
        maxLength={40}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)]"
      />
      <input
        value={region}
        onChange={e => setRegion(e.target.value)}
        placeholder="Subtitle (e.g. Office, Family)"
        maxLength={40}
        className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)]"
      />
      {error && <p className="text-[var(--red)] text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[var(--gold)] text-[var(--bg)] font-bold py-3 rounded-lg hover:bg-[var(--gold-2)] disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create Group'}
      </button>
    </form>
  )
}
