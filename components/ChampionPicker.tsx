'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TournamentBonus } from '@/lib/types'

// All 48 qualified teams for the 2026 FIFA World Cup
const TEAMS = [
  // Group A
  'Mexico', 'South Africa', 'South Korea', 'Czech Republic',
  // Group B
  'Canada', 'Bosnia and Herzegovina', 'Qatar', 'Switzerland',
  // Group C
  'Brazil', 'Morocco', 'Haiti', 'Scotland',
  // Group D
  'United States', 'Paraguay', 'Australia', 'Turkey',
  // Group E
  'Germany', 'Curaçao', 'Ivory Coast', 'Ecuador',
  // Group F
  'Netherlands', 'Japan', 'Sweden', 'Tunisia',
  // Group G
  'Belgium', 'Egypt', 'Iran', 'New Zealand',
  // Group H
  'Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay',
  // Group I
  'France', 'Senegal', 'Iraq', 'Norway',
  // Group J
  'Argentina', 'Algeria', 'Austria', 'Jordan',
  // Group K
  'Portugal', 'DR Congo', 'Uzbekistan', 'Colombia',
  // Group L
  'England', 'Croatia', 'Ghana', 'Panama',
].sort()

interface Props {
  bonus: TournamentBonus
  currentAnswer: string | null
  userId: string
  isLocked: boolean
}

export function ChampionPicker({ bonus, currentAnswer, userId, isLocked: globalLocked }: Props) {
  const [answer, setAnswer] = useState(currentAnswer ?? '')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  // Lock immediately if already picked, or if admin locked it
  const [locked, setLocked] = useState(globalLocked || (currentAnswer !== null && currentAnswer !== ''))
  const supabase = createClient()

  const filtered = TEAMS.filter(t => t.toLowerCase().includes(search.toLowerCase()))

  async function save(team: string) {
    if (locked) return
    setAnswer(team)
    setSaving(true)
    await supabase.from('bonus_predictions').upsert(
      { user_id: userId, bonus_id: bonus.id, answer: team },
      { onConflict: 'user_id,bonus_id' }
    )
    setSaving(false)
    setLocked(true)
  }

  if (locked) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6 text-center">
        <p className="text-xs text-[var(--muted)] uppercase tracking-widest mb-3">
          {globalLocked ? '🔒 Locked' : '✓ Saved'}
        </p>
        {answer ? (
          <p className="text-[var(--text)]">
            Your pick: <strong className="text-[var(--gold)] text-lg">{answer}</strong>
          </p>
        ) : (
          <p className="text-[var(--muted)] text-sm">No champion selected.</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {answer && (
        <div className="bg-[var(--surface)] border border-[var(--green)]/30 rounded-xl p-4 text-center">
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest mb-1">Your current pick</p>
          <p className="text-lg font-bold text-[var(--green)]">{answer}</p>
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search team…"
        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 text-[var(--text)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--gold)]"
      />
      <p className="text-xs text-[var(--muted)] text-center">
        Tap a team to select. Your pick cannot be changed once saved.
      </p>
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
