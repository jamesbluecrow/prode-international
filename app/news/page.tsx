import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'

export default async function NewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: items } = await supabase
    .from('news_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  return (
    <div className="py-6 space-y-6">
      <h1 className="font-display text-3xl">
        <span className="text-[var(--muted)]">SUPER PRODE</span>{' '}
        <span className="text-[var(--gold)]">NEWS</span>
      </h1>

      {(!items || items.length === 0) ? (
        <p className="text-[var(--muted)] text-center py-12 text-sm">No news yet.</p>
      ) : (
        <div className="space-y-6">
          {items.map(item => (
            <div key={item.id} className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
              <div className="relative w-full">
                <Image
                  src={item.image_url}
                  alt={item.caption ?? 'News image'}
                  width={800}
                  height={600}
                  className="w-full h-auto object-contain"
                  unoptimized
                />
              </div>
              {item.caption && (
                <p className="px-4 py-3 text-sm text-[var(--muted)] border-t border-[var(--border)]">
                  {item.caption}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
