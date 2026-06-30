'use client'
import { useEffect, useState } from 'react'
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

function pointsLabel(pts: number | null): string {
  if (pts == null) return ''
  if (pts === 10) return 'Exact score 🎯'
  if (pts >= 13) return 'Exact + penalty bonus 🎯'
  if (pts === 8) return 'Draw + penalty bonus'
  if (pts === 7) return 'Right margin'
  if (pts === 5) return 'Right result'
  if (pts >= 3) return 'Right advancer'
  return 'No points'
}

export function MatchCard({ match, prediction: initialPred, score, isOpen, userId }: Props) {
  const [home, setHome] = useState(initialPred?.pred_home ?? 0)
  const [away, setAway] = useState(initialPred?.pred_away ?? 0)
  const [advancer, setAdvancer] = useState<Side | null>((initialPred?.pred_advancer as Side) ?? null)
  // Lock immediately if prediction already exists
  const [locked, setLocked] = useState(initialPred !== null)
  const [saving, setSaving] = useState(false)
  const [kickoffLabel, setKickoffLabel] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    setKickoffLabel(new Date(match.kickoff_at).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }))
  }, [match.kickoff_at])

  const canEdit = isOpen && !locked

  // For knockout: advancer is auto-determined unless scores are tied
  const isDraw = home === away
  const needsAdvancerPick = match.is_knockout && isDraw

  async function save() {
    if (!canEdit) return
    const effectiveAdvancer = match.is_knockout
      ? (isDraw ? advancer : home > away ? 'home' : 'away')
      : null
    if (match.is_knockout && !effectiveAdvancer) return

    setSaving(true)
    await supabase.from('predictions').upsert(
      {
        user_id: userId,
        match_id: match.id,
        pred_home: home,
        pred_away: away,
        pred_advancer: effectiveAdvancer,
      },
      { onConflict: 'user_id,match_id' }
    )
    setSaving(false)
    setLocked(true)
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
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <span className="text-xs text-[var(--muted)]">vs</span>
          <span className="text-[10px] text-[var(--muted)] tabular-nums">
            {kickoffLabel}
          </span>
        </div>
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
          <ScoreInput value={home} onChange={setHome} disabled={!canEdit} />
          <span className="text-[var(--muted)] font-bold text-lg">—</span>
          <ScoreInput value={away} onChange={setAway} disabled={!canEdit} />
        </div>

        {/* Only show advancer picker for knockout draws */}
        {needsAdvancerPick && (
          <AdvancerPicker
            homeTeam={match.home_team}
            awayTeam={match.away_team}
            homeCode={match.home_code}
            awayCode={match.away_code}
            value={advancer}
            onChange={setAdvancer}
            disabled={!canEdit}
          />
        )}

        {/* Result display */}
        {match.home_score != null && match.away_score != null && (() => {
          const hg = match.home_score
          const ag = match.away_score
          const isDraw = hg === ag
          const winnerSide = isDraw
            ? (match.penalty_winner ?? null)
            : hg > ag ? 'home' : 'away'
          const winnerName = winnerSide === 'home' ? match.home_team : winnerSide === 'away' ? match.away_team : null
          const winnerCode = winnerSide === 'home' ? match.home_code : winnerSide === 'away' ? match.away_code : null
          const viaPens = isDraw && !!match.penalty_winner

          return (
            <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">
                  Result:{' '}
                  <strong className="text-[var(--text)] tabular-nums">
                    {hg} – {ag}
                  </strong>
                  {viaPens && <span className="ml-1 text-xs text-[var(--muted)]">(pens)</span>}
                </span>
                {pts != null && (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`font-display text-xl tabular-nums leading-none ${pointsColor(pts)}`}>
                      {pts > 0 ? `+${pts}` : '0'}
                      <span className="text-xs font-sans ml-0.5">pts</span>
                    </span>
                    <span className={`text-[10px] uppercase tracking-wide ${pointsColor(pts)}`}>
                      {pointsLabel(pts)}
                    </span>
                  </div>
                )}
              </div>
              {winnerName ? (
                <div className="flex items-center gap-2">
                  {winnerCode && (
                    <img
                      src={`https://flagcdn.com/w40/${winnerCode.toLowerCase()}.png`}
                      alt={winnerName}
                      className="w-6 h-4 object-cover rounded-sm flex-shrink-0"
                    />
                  )}
                  <span className="text-sm font-semibold text-[var(--text)]">
                    {winnerName} {viaPens ? 'advances' : 'won'} 🎉
                  </span>
                </div>
              ) : (
                <span className="text-sm text-[var(--muted)]">Draw</span>
              )}
            </div>
          )
        })()}

        {canEdit && (
          <button
            onClick={save}
            disabled={saving || (needsAdvancerPick && !advancer)}
            className="mt-3 w-full py-2.5 rounded-lg text-sm font-bold transition-all bg-[var(--gold)] text-[var(--bg)] hover:bg-[var(--gold-2)] disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}

        {!canEdit && locked && match.home_score == null && (
          <p className="mt-2 text-center text-xs text-[var(--green)] uppercase tracking-widest">
            ✓ Saved
          </p>
        )}

        {!canEdit && !locked && match.home_score == null && (
          <p className="mt-2 text-center text-xs text-[var(--muted)] uppercase tracking-widest">
            🔒 Locked
          </p>
        )}
      </div>
    </div>
  )
}
