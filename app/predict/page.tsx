import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MatchCard } from '@/components/MatchCard'
import { PhaseSection } from '@/components/PhaseSection'
import { TEAM_CODES } from '@/lib/teamCodes'
import type { Match, Prediction, PredictionScore } from '@/lib/types'

const STAGE_LABELS: Record<string, string> = {
  group: 'Group Stage',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter: 'Quarterfinals',
  semi: 'Semifinals',
  third_place: 'Third Place',
  final: 'Final',
}

const STAGE_ORDER = ['group', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']

export default async function PredictPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()

  const [{ data: matches }, { data: predictions }, { data: scores }, { data: bonuses }, { data: bonusPicks }] = await Promise.all([
    supabase.from('matches').select('*').order('kickoff_at'),
    supabase.from('predictions').select('*').eq('user_id', user.id),
    supabase.from('prediction_scores').select('*').eq('user_id', user.id),
    supabase.from('tournament_bonuses').select('*').eq('key', 'champion').single(),
    supabase.from('bonus_predictions').select('*').eq('user_id', user.id),
  ])

  const championBonus = bonuses ?? null
  const championPick = (bonusPicks ?? []).find(b => b.bonus_id === championBonus?.id)?.answer ?? null
  const championLocked = !!(championBonus?.locked || (championBonus?.lock_at && now >= championBonus.lock_at))

  const predMap = new Map((predictions ?? []).map(p => [p.match_id, p]))
  const scoreMap = new Map((scores ?? []).map(s => [s.match_id, s]))

  const byStage = new Map<string, Match[]>()
  for (const m of (matches ?? [])) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

  function isOpen(match: Match): boolean {
    if (match.force_open) return true
    if (match.predictions_locked) return false
    if (match.result_final) return false
    if (match.kickoff_at <= now) return false
    // Future rounds with TBD teams aren't playable yet
    if (!match.home_code || !match.away_code) return false
    return true
  }

  return (
    <div className="py-6 space-y-8">
      <h1 className="font-display text-3xl">
        <span className="text-[var(--muted)]">MY</span>{' '}
        <span className="text-[var(--gold)]">PREDICTIONS</span>
      </h1>

      {/* Champion pick banner */}
      {championBonus && (
        championPick ? (
          <Link href="/champion" className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--gold)]/30 rounded-xl px-4 py-3 hover:border-[var(--gold)]/60 transition-all duration-75 active:scale-[0.98] active:opacity-80">
            <div className="flex-shrink-0">
              {TEAM_CODES[championPick] && (
                <img
                  src={`https://flagcdn.com/w40/${TEAM_CODES[championPick]}.png`}
                  alt={championPick}
                  className="w-10 h-7 object-cover rounded-sm"
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Champion Pick</p>
              <p className="font-bold text-[var(--gold)] truncate">{championPick}</p>
            </div>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-[var(--green)] flex-shrink-0">
              {championLocked ? '🔒 Locked' : '✓ Saved'}
            </span>
          </Link>
        ) : (
          !championLocked && (
            <Link href="/champion" className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 hover:border-[var(--gold)]/40 transition-all duration-75 active:scale-[0.98] active:opacity-80 group">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">Champion Pick</p>
                <p className="text-sm text-[var(--text)] group-hover:text-[var(--gold)] transition-colors">Pick your World Cup winner →</p>
              </div>
              <span className="text-2xl">🏆</span>
            </Link>
          )
        )
      )}

      {STAGE_ORDER.filter(s => byStage.has(s)).map(stage => {
        const stageMatches = byStage.get(stage)!
        const completedCount = stageMatches.filter(m => m.kickoff_at <= now).length
        const allFinal = stageMatches.every(m => m.result_final)
        const anyStarted = completedCount > 0
        const defaultOpen = anyStarted && !allFinal
        return (
          <PhaseSection
            key={stage}
            label={STAGE_LABELS[stage] ?? stage}
            matchCount={stageMatches.length}
            completedCount={completedCount}
            defaultOpen={defaultOpen}
          >
            {stageMatches.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={(predMap.get(match.id) as Prediction) ?? null}
                score={(scoreMap.get(match.id) as PredictionScore) ?? null}
                isOpen={isOpen(match)}
                userId={user.id}
              />
            ))}
          </PhaseSection>
        )
      })}

      {(matches ?? []).length === 0 && (
        <p className="text-[var(--muted)] text-center py-12">
          No matches loaded yet.
        </p>
      )}
    </div>
  )
}
