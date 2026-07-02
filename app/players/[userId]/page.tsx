import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { TEAM_CODES } from '@/lib/teamCodes'
import { ColorAvatar } from '@/components/ColorAvatar'
import type { Stage } from '@/lib/types'

const STAGE_LABELS: Record<Stage, string> = {
  group: 'Group Stage',
  round_of_32: 'Round of 32',
  round_of_16: 'Round of 16',
  quarter: 'Quarterfinals',
  semi: 'Semifinals',
  third_place: 'Third Place',
  final: 'Final',
}

const STAGE_ORDER: Stage[] = ['group', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: targetPreds }, { data: myPreds }] = await Promise.all([
    supabase.from('profiles').select('display_name, avatar_url').eq('id', userId).single(),
    supabase.from('predictions').select('match_id, pred_home, pred_away, pred_advancer').eq('user_id', userId),
    supabase.from('predictions').select('match_id').eq('user_id', user.id),
  ])

  if (!profile) notFound()

  const matchIds = (targetPreds ?? []).map(p => p.match_id)

  const [{ data: matchDetails }, { data: scoreRows }] = await Promise.all([
    matchIds.length > 0
      ? supabase.from('matches').select('id, home_team, away_team, kickoff_at, home_code, away_code, stage, home_score, away_score, result_final').in('id', matchIds)
      : Promise.resolve({ data: [] as never[], error: null }),
    matchIds.length > 0
      ? supabase.from('prediction_scores').select('match_id, points').eq('user_id', userId).in('match_id', matchIds)
      : Promise.resolve({ data: [] as never[], error: null }),
  ])

  const myMatchIds = new Set((myPreds ?? []).map(p => p.match_id))
  const matchMap = new Map((matchDetails ?? []).map((m: { id: string; home_team: string; away_team: string; kickoff_at: string; home_code: string | null; away_code: string | null; stage: string; home_score: number | null; away_score: number | null; result_final: boolean }) => [m.id, m]))
  const scoreMap = new Map((scoreRows ?? []).map((s: { match_id: string | null; points: number | null }) => [s.match_id ?? '', s.points]))
  const predMap = new Map((targetPreds ?? []).map(p => [p.match_id, p]))

  const enriched = matchIds
    .filter(id => matchMap.has(id))
    .map(id => {
      const m = matchMap.get(id)!
      const pred = predMap.get(id)!
      return {
        match_id: id,
        pred_home: pred.pred_home,
        pred_away: pred.pred_away,
        pred_advancer: pred.pred_advancer,
        points: scoreMap.get(id) ?? null,
        result_final: m.result_final,
        home_score: m.home_score,
        away_score: m.away_score,
        stage: m.stage as Stage,
        home_team: m.home_team,
        away_team: m.away_team,
        kickoff_at: m.kickoff_at,
        home_code: m.home_code,
        away_code: m.away_code,
        revealed: myMatchIds.has(id),
      }
    })
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())

  const byStage = new Map<Stage, typeof enriched>()
  for (const pred of enriched) {
    if (!byStage.has(pred.stage)) byStage.set(pred.stage, [])
    byStage.get(pred.stage)!.push(pred)
  }

  const isOwnProfile = userId === user.id

  return (
    <div className="py-6 space-y-6">
      <Link href="/ranking" className="text-[var(--muted)] hover:text-[var(--text)] text-sm transition-colors">
        ← Rankings
      </Link>

      <div className="flex flex-col items-center gap-3 py-2">
        <ColorAvatar name={profile.display_name} avatarUrl={profile.avatar_url ?? null} size={72} />
        <h1 className="font-display text-3xl text-[var(--gold)]">
          {profile.display_name.toUpperCase()}
        </h1>
      </div>

      {!isOwnProfile && (
        <p className="text-xs text-[var(--muted)]">
          Predictions are revealed only for matches where you have submitted your own pick.
        </p>
      )}

      {enriched.length === 0 && (
        <p className="text-[var(--muted)] text-center py-8 text-sm">No predictions yet.</p>
      )}

      {STAGE_ORDER.filter(s => byStage.has(s)).map(stage => (
        <div key={stage} className="space-y-2">
          <h2 className="text-xs uppercase tracking-widest text-[var(--muted)] font-medium">
            {STAGE_LABELS[stage]}
          </h2>
          <div className="space-y-1.5">
            {byStage.get(stage)!.map(pred => {
              const homeCode = pred.home_code ?? TEAM_CODES[pred.home_team]
              const awayCode = pred.away_code ?? TEAM_CODES[pred.away_team]
              return (
                <div
                  key={pred.match_id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
                >
                  {/* Home team */}
                  <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                    <span className="truncate text-[var(--text)]">{pred.home_team}</span>
                    {homeCode && (
                      <Image
                        src={`https://flagcdn.com/w20/${homeCode}.png`}
                        alt={pred.home_team}
                        width={16}
                        height={11}
                        className="rounded-sm flex-shrink-0"
                      />
                    )}
                  </div>

                  {/* Prediction */}
                  <div className="flex items-center gap-1 font-mono font-bold text-base w-14 justify-center flex-shrink-0">
                    {pred.revealed ? (
                      <>
                        <span className="text-[var(--gold)]">{pred.pred_home}</span>
                        <span className="text-[var(--muted)] text-xs">-</span>
                        <span className="text-[var(--gold)]">{pred.pred_away}</span>
                      </>
                    ) : (
                      <span className="text-[var(--muted)] text-lg">?</span>
                    )}
                  </div>

                  {/* Away team */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {awayCode && (
                      <Image
                        src={`https://flagcdn.com/w20/${awayCode}.png`}
                        alt={pred.away_team}
                        width={16}
                        height={11}
                        className="rounded-sm flex-shrink-0"
                      />
                    )}
                    <span className="truncate text-[var(--text)]">{pred.away_team}</span>
                  </div>

                  {/* Actual result + points */}
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs w-20 justify-end">
                    {pred.result_final && (
                      <span className="text-[var(--muted)] font-mono">
                        {pred.home_score}-{pred.away_score}
                      </span>
                    )}
                    {pred.revealed && pred.result_final && pred.points != null && (
                      <span className={`font-bold px-1.5 py-0.5 rounded ${
                        pred.points === 10
                          ? 'bg-[var(--gold)]/10 text-[var(--gold)]'
                          : pred.points > 0
                          ? 'bg-[var(--green)]/10 text-[var(--green)]'
                          : 'bg-[var(--red)]/10 text-[var(--red)]'
                      }`}>
                        {pred.points > 0 ? `+${pred.points}` : '0'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
