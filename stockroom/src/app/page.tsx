import Link from 'next/link'
import { db, imgUrl } from '@/lib/supabase/server'
import ItemCard from '@/components/ItemCard'

export default async function Home({ searchParams }: { searchParams: { q?: string } }) {
  const s = db()
  const q = (searchParams.q ?? '').trim().slice(0, 60).replace(/[%_\\,()]/g, '')

  if (q) {
    const { data } = await s
    .from('items')
    .select('id, name, quantity, image_path')
    .eq('is_active', true)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(100)

  return (
      <section>
        <h1 className="mb-1 text-xl font-semibold">Results for “{q}”</h1>
        <Link href="/" className="text-sm text-brand hover:underline">Back to categories</Link>
        <div className="mt-6 grid justify-center gap-6 [grid-template-columns:repeat(auto-fill,160px)]">
          {(data ?? []).map((i) => <ItemCard key={i.id} item={i} />)}
        </div>
        {!data?.length && <p className="mt-6 text-center text-sm text-ink/60">No items match that name.</p>}
      </section>
    )
  }

  const { data: cats } = await s.from('categories').select('id, name, image_path').order('name')
  return (
    <section>
      <h1 className="mb-8 text-center text-xl font-semibold">Categories</h1>
      <div className="mx-auto grid max-w-[790px] justify-center gap-x-[35px] gap-y-[38px] [grid-template-columns:repeat(auto-fill,90px)] sm:[grid-template-columns:repeat(auto-fill,100px)]">
        {(cats ?? []).map((c) => {
          const src = imgUrl(c.image_path)
          return (
            <Link key={c.id} href={`/c/${c.id}`} className="group block w-[90px] sm:w-[100px]">
              <div className="flex h-[90px] w-[90px] items-center justify-center overflow-hidden rounded-lg border border-rule bg-white shadow-sm transition-shadow group-hover:shadow-md sm:h-[100px] sm:w-[100px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {src ? <img src={src} alt="" className="h-full w-full object-cover" /> :
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1d4e5f" strokeWidth="1.6" aria-hidden="true"><path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>}
              </div>
              <p className="mt-2 line-clamp-2 break-words text-center text-xs font-medium leading-tight">{c.name}</p>
            </Link>
          )
        })}
      </div>
      {!cats?.length && <p className="text-center text-sm text-ink/60">No categories yet. An administrator can add them under Manage inventory.</p>}
    </section>
  )
}
