import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/login`)

  const { data: group, error } = await supabase.rpc('join_group', { p_code: code })

  if (error || !group) {
    return (
      <div className="py-12 text-center">
        <p className="text-[var(--red)] mb-2">Grupo no encontrado o lleno.</p>
        <a href="/groups" className="text-[var(--gold)] text-sm hover:underline">
          Ver mis grupos
        </a>
      </div>
    )
  }

  redirect(`/groups/${group.id}`)
}
