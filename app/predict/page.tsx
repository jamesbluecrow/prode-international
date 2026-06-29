import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MatchCard } from '@/components/MatchCard'
import type { Match, Prediction, PredictionScore } from '@/lib/types'

const STAGE_LABELS: Record<string, string> = {
  group: 'Fase de Grupos',
  round_of_32: 'Ronda de 32',
  round_of_16: 'Octavos de Final',
  quarter: 'Cuartos de Final',
  semi: 'Semifinales',
  third_place: 'Tercer Puesto',
  final: 'Final',
}

const STAGE_ORDER = ['group', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']

export default async function PredictPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: matches }, { data: predictions }, { data: scores }] = await Promise.all([
    supabase.from('matches').select('*').order('kickoff_at'),
    supabase.from('predictions').select('*').eq('user_id', user.id),
    supabase.from('prediction_scores').select('*').eq('user_id', user.id),
  ])

  const predMap = new Map((predictions ?? []).map(p => [p.match_id, p]))
  const scoreMap = new Map((scores ?? []).map(s => [s.match_id, s]))

  const byStage = new Map<string, Match[]>()
  for (const m of (matches ?? [])) {
    if (!byStage.has(m.stage)) byStage.set(m.stage, [])
    byStage.get(m.stage)!.push(m)
  }

  const now = new Date().toISOString()

  function isOpen(match: Match): boolean {
    if (match.force_open) return true
    if (match.predictions_locked) return false
    if (match.kickoff_at <= now) return false
    return true
  }

  return (
    <div className="py-6 space-y-8">
      <h1 className="font-display text-3xl">
        <span className="text-[var(--muted)]">MI</span>{' '}
        <span className="text-[var(--gold)]">PRODE</span>
      </h1>

      {STAGE_ORDER.filter(s => byStage.has(s)).map(stage => (
        <section key={stage}>
          <h2 className="font-display text-xl text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
            {STAGE_LABELS[stage] ?? stage}
          </h2>
          <div className="space-y-3">
            {byStage.get(stage)!.map(match => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={(predMap.get(match.id) as Prediction) ?? null}
                score={(scoreMap.get(match.id) as PredictionScore) ?? null}
                isOpen={isOpen(match)}
                userId={user.id}
              />
            ))}
          </div>
        </section>
      ))}

      {(matches ?? []).length === 0 && (
        <p className="text-[var(--muted)] text-center py-12">
          No hay partidos cargados aún.
        </p>
      )}
    </div>
  )
}
