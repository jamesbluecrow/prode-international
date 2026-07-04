import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return null
  return user
}

export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('predictions')
    .select('match_id, pred_home, pred_away, pred_advancer')
    .eq('user_id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ predictions: data ?? [] })
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { userId, matchId, predHome, predAway, predAdvancer } = body

  if (!userId || !matchId || predHome == null || predAway == null) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('predictions').upsert(
    {
      user_id: userId,
      match_id: matchId,
      pred_home: predHome,
      pred_away: predAway,
      pred_advancer: predAdvancer ?? null,
    },
    { onConflict: 'user_id,match_id' }
  )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
