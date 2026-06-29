'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TournamentBonus } from '@/lib/types'

const TEAM_CODES: Record<string, string> = {
  'Algeria': 'dz', 'Argentina': 'ar', 'Australia': 'au', 'Austria': 'at',
  'Belgium': 'be', 'Bosnia and Herzegovina': 'ba', 'Brazil': 'br',
  'Canada': 'ca', 'Cape Verde': 'cv', 'Colombia': 'co', 'Croatia': 'hr',
  'Curaçao': 'cw', 'Czech Republic': 'cz', 'DR Congo': 'cd',
  'Ecuador': 'ec', 'Egypt': 'eg', 'England': 'gb-eng',
  'France': 'fr', 'Germany': 'de', 'Ghana': 'gh', 'Haiti': 'ht',
  'Iran': 'ir', 'Iraq': 'iq', 'Ivory Coast': 'ci', 'Japan': 'jp',
  'Jordan': 'jo', 'Mexico': 'mx', 'Morocco': 'ma', 'Netherlands': 'nl',
  'New Zealand': 'nz', 'Norway': 'no', 'Panama': 'pa', 'Paraguay': 'py',
  'Portugal': 'pt', 'Qatar': 'qa', 'Saudi Arabia': 'sa', 'Scotland': 'gb-sct',
  'Senegal': 'sn', 'South Africa': 'za', 'South Korea': 'kr', 'Spain': 'es',
  'Sweden': 'se', 'Switzerland': 'ch', 'Tunisia': 'tn', 'Turkey': 'tr',
  'United States': 'us', 'Uruguay': 'uy', 'Uzbekistan': 'uz',
}

// All 48 qualified teams for the 2026 FIFA World Cup
const TEAMS = Object.keys(TEAM_CODES).sort()

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
          <div className="flex items-center justify-center gap-3">
            {TEAM_CODES[answer] && (
              <img
                src={`https://flagcdn.com/w40/${TEAM_CODES[answer]}.png`}
                alt={answer}
                className="w-10 h-7 object-cover rounded-sm"
              />
            )}
            <p className="text-[var(--text)]">
              Your pick: <strong className="text-[var(--gold)] text-lg">{answer}</strong>
            </p>
          </div>
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
          <p className="text-xs text-[var(--muted)] uppercase tracking-widest mb-2">Your current pick</p>
          <div className="flex items-center justify-center gap-2">
            {TEAM_CODES[answer] && (
              <img
                src={`https://flagcdn.com/w40/${TEAM_CODES[answer]}.png`}
                alt={answer}
                className="w-8 h-6 object-cover rounded-sm"
              />
            )}
            <p className="text-lg font-bold text-[var(--green)]">{answer}</p>
          </div>
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
              answer === team
                ? 'border-[var(--green)] bg-[var(--green)]/10 text-[var(--green)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--muted)]'
            }`}
          >
            {TEAM_CODES[team] && (
              <img
                src={`https://flagcdn.com/w40/${TEAM_CODES[team]}.png`}
                alt={team}
                className="w-8 h-6 object-cover rounded-sm flex-shrink-0"
              />
            )}
            <span>{team}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
