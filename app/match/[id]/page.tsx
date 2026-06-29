import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ColorAvatar } from '@/components/ColorAvatar'

function pointsColor(pts: number | null): string {
  if (pts === 10) return 'text-[var(--gold)]'
  if (pts === 7) return 'text-[var(--green)]'
  if (pts === 5) return 'text-[var(--blue)]'
  if (pts != null && pts >= 3) return 'text-[var(--green)]'
  return 'text-[var(--muted)]'
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: match }, { data: scores }] = await Promise.all([
    supabase.from('matches').select('*').eq('id', id).single(),
    supabase
      .from('prediction_scores')
      .select('*')
      .eq('match_id', id)
      .order('points', { ascending: false }),
  ])

  if (!match) notFound()

  const userIds = (scores ?? []).map(s => s.user_id).filter(Boolean) as string[]
  const { data: profiles } = userIds.length > 0
    ? await supabase.from('profiles').select('id, display_name').in('id', userIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return (
    <div className="py-6">
      <div className="flex items-center gap-3 mb-6">
        {match.home_code && (
          <img
            src={`https://flagcdn.com/w40/${match.home_code.toLowerCase()}.png`}
            alt={match.home_team}
            className="w-10 h-7 object-cover rounded"
          />
        )}
        <div className="flex-1">
          <h1 className="font-display text-2xl">
            {match.home_team}{' '}
            <span className="text-[var(--muted)]">vs</span>{' '}
            {match.away_team}
          </h1>
          {match.home_score != null && (
            <p className="text-[var(--muted)] text-sm">
              Result:{' '}
              <strong className="text-[var(--text)]">
                {match.home_score} – {match.away_score}
              </strong>
              {match.penalty_winner && (
                <span className="ml-1 text-xs">(pen.)</span>
              )}
            </p>
          )}
        </div>
        {match.away_code && (
          <img
            src={`https://flagcdn.com/w40/${match.away_code.toLowerCase()}.png`}
            alt={match.away_team}
            className="w-10 h-7 object-cover rounded"
          />
        )}
      </div>

      <div className="space-y-2">
        {(scores ?? []).map(s => {
          const profile = profileMap.get(s.user_id ?? '')
          const pts = s.points
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                s.user_id === user.id
                  ? 'border-[var(--green)]/40 bg-[var(--green)]/5'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
            >
              <ColorAvatar name={profile?.display_name ?? '?'} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.display_name ?? 'User'}
                </p>
                <p className="text-xs text-[var(--muted)] tabular">
                  {s.pred_home} – {s.pred_away}
                  {s.pred_advancer && (
                    <span className="ml-1">
                      · advances{' '}
                      {s.pred_advancer === 'home' ? match.home_team : match.away_team}
                    </span>
                  )}
                </p>
              </div>
              {pts != null && (
                <span className={`font-bold tabular text-lg ${pointsColor(pts)}`}>
                  {pts > 0 ? `+${pts}` : '0'}
                </span>
              )}
            </div>
          )
        })}
        {(scores ?? []).length === 0 && (
          <p className="text-[var(--muted)] text-center py-8 text-sm">
            Predictions are revealed when the match closes.
          </p>
        )}
      </div>
    </div>
  )
}
