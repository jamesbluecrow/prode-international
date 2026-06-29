import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CreateGroupForm } from '@/components/CreateGroupForm'
import { JoinGroupBox } from '@/components/JoinGroupBox'

export default async function GroupsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)

  const groupIds = (memberships ?? []).map(m => m.group_id)
  const { data: groups } = groupIds.length > 0
    ? await supabase.from('groups').select('*').in('id', groupIds)
    : { data: [] }

  return (
    <div className="py-6 space-y-8">
      <h1 className="font-display text-3xl">
        <span className="text-[var(--muted)]">MIS</span>{' '}
        <span className="text-[var(--gold)]">GRUPOS</span>
      </h1>

      {(groups ?? []).length > 0 ? (
        <div className="space-y-2">
          {(groups ?? []).map(g => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--gold)]/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/20 flex items-center justify-center font-display text-lg text-[var(--gold)]">
                {g.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{g.name}</p>
                {g.region && (
                  <p className="text-xs text-[var(--muted)] truncate">{g.region}</p>
                )}
              </div>
              <p className="text-xs text-[var(--muted)] font-mono flex-shrink-0">
                {g.invite_code}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[var(--muted)] text-sm">Todavía no estás en ningún grupo.</p>
      )}

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="font-display text-xl mb-4 text-[var(--text)]">Unirse con código</h2>
        <JoinGroupBox />
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="font-display text-xl mb-4 text-[var(--text)]">Crear grupo</h2>
        <CreateGroupForm />
      </div>
    </div>
  )
}
