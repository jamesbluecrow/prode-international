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

type Tab = 'results' | 'locks' | 'deadlines' | 'champion' | 'admins'

const TABS: { key: Tab; label: string }[] = [
  { key: 'results', label: 'Resultados' },
  { key: 'locks', label: 'Bloqueos' },
  { key: 'deadlines', label: 'Fechas' },
  { key: 'champion', label: 'Campeón' },
  { key: 'admins', label: 'Admins' },
]

export function AdminClient({
  matches: initMatches,
  deadlines: initDeadlines,
  champion: initChampion,
  profiles: initProfiles,
  currentUserId,
}: Props) {
  const [matches, setMatches] = useState(initMatches)
  const [deadlines, setDeadlines] = useState(initDeadlines)
  const [champion, setChampion] = useState(initChampion)
  const [profiles, setProfiles] = useState(initProfiles)
  const [tab, setTab] = useState<Tab>('results')
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

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--gold)] text-[var(--bg)]'
                : 'bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] border border-[var(--border)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'results' && (
        <div className="space-y-3">
          {matches.map(m => (
            <div key={m.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
              <p className="font-medium text-sm mb-3 text-[var(--text)]">
                {m.home_team} vs {m.away_team}
                <span className="ml-2 text-xs text-[var(--muted)]">({m.stage})</span>
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={m.home_score ?? ''}
                    placeholder="Local"
                    className="w-16 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-center text-sm tabular text-[var(--text)]"
                    onBlur={e => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v)) updateMatch(m.id, { home_score: v })
                    }}
                  />
                  <span className="text-[var(--muted)]">–</span>
                  <input
                    type="number"
                    min={0}
                    defaultValue={m.away_score ?? ''}
                    placeholder="Visit."
                    className="w-16 bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-center text-sm tabular text-[var(--text)]"
                    onBlur={e => {
                      const v = parseInt(e.target.value)
                      if (!isNaN(v)) updateMatch(m.id, { away_score: v })
                    }}
                  />
                </div>
                {m.is_knockout && (
                  <select
                    defaultValue={m.penalty_winner ?? ''}
                    onChange={e =>
                      updateMatch(m.id, {
                        penalty_winner: (e.target.value as 'home' | 'away') || null,
                      })
                    }
                    className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)]"
                  >
                    <option value="">Sin penales</option>
                    <option value="home">Pen: {m.home_team}</option>
                    <option value="away">Pen: {m.away_team}</option>
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={m.result_final}
                    onChange={e => updateMatch(m.id, { result_final: e.target.checked })}
                    className="accent-[var(--gold)]"
                  />
                  Final
                </label>
                {saving === m.id && (
                  <span className="text-xs text-[var(--muted)]">Guardando…</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'locks' && (
        <div className="space-y-3">
          {matches.map(m => (
            <div
              key={m.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 flex-wrap"
            >
              <p className="font-medium text-sm flex-1 min-w-0 truncate text-[var(--text)]">
                {m.home_team} vs {m.away_team}
              </p>
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
              {saving === m.id && (
                <span className="text-xs text-[var(--muted)]">…</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'deadlines' && (
        <div className="space-y-3">
          {deadlines.map(d => (
            <div
              key={d.stage}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4"
            >
              <p className="font-medium text-sm w-36 flex-shrink-0 text-[var(--text)]">
                {d.stage}
              </p>
              <input
                type="datetime-local"
                defaultValue={d.lock_at.slice(0, 16)}
                onBlur={e =>
                  updateDeadline(d.stage, new Date(e.target.value).toISOString())
                }
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)]"
              />
              {saving === d.stage && (
                <span className="text-xs text-[var(--muted)]">…</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'champion' && champion && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-[var(--muted)] mb-1">Respuesta correcta</p>
              <input
                type="text"
                defaultValue={champion.correct_answer ?? ''}
                placeholder="Equipo campeón…"
                onBlur={e =>
                  updateChampion({ correct_answer: e.target.value || null })
                }
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)]"
              />
            </div>
            <div>
              <p className="text-sm text-[var(--muted)] mb-1">Puntos</p>
              <input
                type="number"
                min={0}
                defaultValue={champion.points}
                onBlur={e =>
                  updateChampion({ points: parseInt(e.target.value) || 0 })
                }
                className="w-24 bg-[var(--surface-2)] border border-[var(--border)] rounded px-3 py-2 text-sm tabular text-center text-[var(--text)]"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={champion.locked}
              onChange={e => updateChampion({ locked: e.target.checked })}
              className="accent-[var(--red)]"
            />
            Cerrar pronóstico de campeón
          </label>
          {saving === 'champion' && (
            <span className="text-xs text-[var(--muted)]">Guardando…</span>
          )}
        </div>
      )}

      {tab === 'admins' && (
        <div className="space-y-2">
          {profiles.map(p => (
            <div
              key={p.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-[var(--text)]">{p.display_name}</p>
              </div>
              {p.id === currentUserId ? (
                <span className="text-xs text-[var(--gold)] px-2 py-1 border border-[var(--gold)]/30 rounded">
                  Tú
                </span>
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
              {saving === p.id && (
                <span className="text-xs text-[var(--muted)]">…</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
