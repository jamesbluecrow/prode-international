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

function pointsColor(pts: number | null): string {
  if (pts === 10) return 'text-[var(--gold)]'
  if (pts === 7) return 'text-[var(--green)]'
  if (pts === 5) return 'text-[var(--blue)]'
  if (pts != null && pts >= 3) return 'text-[var(--green)]'
  return 'text-[var(--muted)]'
}

export function MatchCard({ match, prediction: initialPred, score, isOpen, userId }: Props) {
  const [home, setHome] = useState(initialPred?.pred_home ?? 0)
  const [away, setAway] = useState(initialPred?.pred_away ?? 0)
  const [advancer, setAdvancer] = useState<Side | null>((initialPred?.pred_advancer as Side) ?? null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  async function save() {
    if (!isOpen) return
    if (match.is_knockout && !advancer) return
    setSaving(true)
    await supabase.from('predictions').upsert(
      {
        user_id: userId,
        match_id: match.id,
        pred_home: home,
        pred_away: away,
        pred_advancer: match.is_knockout ? advancer : null,
      },
      { onConflict: 'user_id,match_id' }
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const pts = score?.points

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Teams header */}
      <div className="flex items-center px-4 py-3 gap-3 bg-[var(--surface-2)]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {match.home_code && (
            <img
              src={`https://flagcdn.com/w40/${match.home_code.toLowerCase()}.png`}
              alt={match.home_team}
              className="w-8 h-6 object-cover rounded-sm flex-shrink-0"
            />
          )}
          <span className="font-medium text-sm truncate">{match.home_team}</span>
        </div>
        <span className="text-xs text-[var(--muted)] flex-shrink-0">vs</span>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="font-medium text-sm truncate">{match.away_team}</span>
          {match.away_code && (
            <img
              src={`https://flagcdn.com/w40/${match.away_code.toLowerCase()}.png`}
              alt={match.away_team}
              className="w-8 h-6 object-cover rounded-sm flex-shrink-0"
            />
          )}
        </div>
      </div>

      {/* Prediction inputs */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-center gap-6">
          <ScoreInput value={home} onChange={setHome} disabled={!isOpen} />
          <span className="text-[var(--muted)] font-bold text-lg">—</span>
          <ScoreInput value={away} onChange={setAway} disabled={!isOpen} />
        </div>

        {match.is_knockout && (
          <AdvancerPicker
            homeTeam={match.home_team}
            awayTeam={match.away_team}
            homeCode={match.home_code}
            awayCode={match.away_code}
            value={advancer}
            onChange={setAdvancer}
            disabled={!isOpen}
          />
        )}

        {/* Result display */}
        {match.home_score != null && match.away_score != null && (
          <div className="mt-3 flex items-center justify-between text-sm border-t border-[var(--border)] pt-3">
            <span className="text-[var(--muted)]">
              Resultado:{' '}
              <strong className="text-[var(--text)]">
                {match.home_score} – {match.away_score}
              </strong>
              {match.penalty_winner && (
                <span className="ml-1 text-xs">(pen.)</span>
              )}
            </span>
            {pts != null && (
              <span className={`font-bold tabular text-base ${pointsColor(pts)}`}>
                {pts > 0 ? `+${pts}` : '0'} pts
              </span>
            )}
          </div>
        )}

        {isOpen && (
          <button
            onClick={save}
            disabled={saving || (match.is_knockout && !advancer)}
            className={`mt-3 w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
              saved
                ? 'bg-[var(--green)]/20 text-[var(--green)] border border-[var(--green)]/30'
                : 'bg-[var(--gold)] text-[var(--bg)] hover:bg-[var(--gold-2)] disabled:opacity-40'
            }`}
          >
            {saved ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar'}
          </button>
        )}

        {!isOpen && match.home_score == null && (
          <p className="mt-2 text-center text-xs text-[var(--muted)] uppercase tracking-widest">
            🔒 Cerrado
          </p>
        )}
      </div>
    </div>
  )
}
