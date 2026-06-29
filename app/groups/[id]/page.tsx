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

  const [{ data: group }, { data: rows }] = await Promise.all([
    supabase.from('groups').select('*').eq('id', id).single(),
    supabase.rpc('group_leaderboard', { p_group: id }),
  ])

  if (!group) notFound()

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
        <LeaderboardTable rows={rows} currentUserId={user.id} />
      ) : (
        <p className="text-[var(--muted)] text-center py-8 text-sm">
          Aún no hay puntos en este grupo.
        </p>
      )}
    </div>
  )
}
