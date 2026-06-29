'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TournamentBonus } from '@/lib/types'

const TEAMS = [
  'Argentina', 'Brasil', 'Francia', 'Inglaterra', 'España', 'Alemania',
  'Portugal', 'Países Bajos', 'Bélgica', 'Uruguay', 'Colombia', 'México',
  'Estados Unidos', 'Canadá', 'Marruecos', 'Senegal', 'Japón', 'Corea del Sur',
  'Australia', 'Croacia', 'Serbia', 'Suiza', 'Dinamarca', 'Polonia',
  'Ecuador', 'Perú', 'Venezuela', 'Bolivia', 'Paraguay', 'Chile',
  'Costa Rica', 'Panamá', 'Jamaica', 'Honduras', 'El Salvador', 'Guatemala',
  'Arabia Saudita', 'Irán', 'Irak', 'Siria', 'Jordania',
  'Ghana', 'Nigeria', 'Costa de Marfil', 'Camerún', 'Egipto', 'Argelia',
  'Nueva Zelanda', 'Fiyi', 'Tahití',
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

  const filtered = TEAMS.filter(t => t.toLowerCase().includes(search.toLowerCase()))

  async function save(team: string) {
    if (isLocked) return
    setAnswer(team)
    setSaving(true)
    await supabase.from('bonus_predictions').upsert(
      { user_id: userId, bonus_id: bonus.id, answer: team },
      { onConflict: 'user_id,bonus_id' }
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (isLocked) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--red)]/30 rounded-xl p-6 text-center">
        <p className="text-[var(--red)] text-sm uppercase tracking-widest mb-3">🔒 Cerrado</p>
        {answer ? (
          <p className="text-[var(--text)]">
            Tu elección: <strong className="text-[var(--gold)]">{answer}</strong>
          </p>
        ) : (
          <p className="text-[var(--muted)] text-sm">No elegiste campeón.</p>
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
