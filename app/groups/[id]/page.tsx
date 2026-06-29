import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { LeaderboardTable } from '@/components/LeaderboardTable'
import { ShareButton } from '@/components/ShareButton'

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: group }, { data: rows }, { data: bonuses }, { data: bonusPicks }] = await Promise.all([
    supabase.from('groups').select('*').eq('id', id).single(),
    supabase.rpc('group_leaderboard', { p_group: id }),
    supabase.from('tournament_bonuses').select('id').eq('key', 'champion').single(),
    supabase.from('bonus_predictions').select('user_id, answer'),
  ])

  if (!group) notFound()

  const championMap: Record<string, string> = {}
  if (bonuses?.id && bonusPicks) {
    for (const pick of bonusPicks) {
      if (pick.user_id) championMap[pick.user_id] = pick.answer
    }
  }

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--gold)]">
          {group.name.toUpperCase()}
        </h1>
        {group.region && (
          <p className="text-[var(--muted)] text-sm mt-1">{group.region}</p>
        )}
        <p className="text-xs text-[var(--muted)] mt-1 font-mono">{group.invite_code}</p>
      </div>

      <ShareButton code={group.invite_code} />

      {rows && rows.length > 0 ? (
        <LeaderboardTable rows={rows} currentUserId={user.id} championMap={championMap} />
      ) : (
        <p className="text-[var(--muted)] text-center py-8 text-sm">
          No points in this group yet.
        </p>
      )}
    </div>
  )
}
