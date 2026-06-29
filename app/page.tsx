import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StatTile } from '@/components/StatTile'
import type { Match } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date().toISOString()

  const [{ data: myRow }, { data: nextMatches }, { data: myPreds }, { data: allRows }] =
    await Promise.all([
      supabase.from('leaderboard').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('matches').select('*').gt('kickoff_at', now).order('kickoff_at').limit(5),
      supabase.from('predictions').select('match_id').eq('user_id', user.id),
      supabase.from('leaderboard').select('user_id'),
    ])

  const rank = (allRows ?? []).findIndex(r => r.user_id === user.id) + 1
  const predMatchIds = new Set((myPreds ?? []).map(p => p.match_id))

  return (
    <div className="py-6 space-y-8">
      <div>
        <p className="text-[var(--muted)] text-sm">Welcome,</p>
        <h1 className="font-display text-4xl text-[var(--gold)]">
          {(user.email?.split('@')[0] ?? 'PLAYER').toUpperCase()}
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Points" value={myRow?.total_points ?? 0} />
        <StatTile label="Rank" value={rank > 0 ? `#${rank}` : '–'} />
        <StatTile label="Exact" value={myRow?.exact_hits ?? 0} />
      </div>

      {(nextMatches ?? []).length > 0 && (
        <section>
          <h2 className="font-display text-xl text-[var(--text)] mb-3">
            UPCOMING MATCHES
          </h2>
          <div className="space-y-2">
            {(nextMatches ?? []).map((m: Match) => {
              const hasPred = predMatchIds.has(m.id)
              return (
                <Link
                  key={m.id}
                  href="/predict"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)]/40 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {m.home_code && (
                      <img
                        src={`https://flagcdn.com/w40/${m.home_code.toLowerCase()}.png`}
                        alt={m.home_team}
                        className="w-6 h-4 object-cover rounded-sm flex-shrink-0"
                      />
                    )}
                    <span className="text-sm font-medium truncate">
                      {m.home_team} vs {m.away_team}
                    </span>
                    {m.away_code && (
                      <img
                        src={`https://flagcdn.com/w40/${m.away_code.toLowerCase()}.png`}
                        alt={m.away_team}
                        className="w-6 h-4 object-cover rounded-sm flex-shrink-0"
                      />
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium flex-shrink-0 ${
                      hasPred
                        ? 'bg-[var(--green)]/20 text-[var(--green)]'
                        : 'bg-[var(--red)]/20 text-[var(--red)]'
                    }`}
                  >
                    {hasPred ? '✓ Done' : 'Pending'}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/predict"
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center hover:border-[var(--gold)]/40 transition-colors"
        >
          <p className="font-display text-lg text-[var(--gold)]">PREDECIR</p>
          <p className="text-xs text-[var(--muted)] mt-1">Make predictions</p>
        </Link>
        <Link
          href="/ranking"
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center hover:border-[var(--gold)]/40 transition-colors"
        >
          <p className="font-display text-lg text-[var(--gold)]">RANKING</p>
          <p className="text-xs text-[var(--muted)] mt-1">Global standings</p>
        </Link>
        <Link
          href="/groups"
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center hover:border-[var(--gold)]/40 transition-colors"
        >
          <p className="font-display text-lg text-[var(--gold)]">GRUPOS</p>
          <p className="text-xs text-[var(--muted)] mt-1">Create & join</p>
        </Link>
        <Link
          href="/champion"
          className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 text-center hover:border-[var(--gold)]/40 transition-colors"
        >
          <p className="font-display text-lg text-[var(--gold)]">CHAMPION</p>
          <p className="text-xs text-[var(--muted)] mt-1">Your pick</p>
        </Link>
      </div>
    </div>
  )
}
