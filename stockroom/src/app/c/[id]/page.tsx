
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/supabase/server'
import ItemCard from '@/components/ItemCard'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Category({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { q?: string; sort?: string }
}) {
  if (!UUID.test(params.id)) notFound()

  const q = (searchParams.q ?? '')
    .trim()
    .slice(0, 60)
    .replace(/[%*\\_,()]/g, '')

  const sort = ['name', 'qty-asc', 'qty-desc'].includes(searchParams.sort ?? '')
    ? searchParams.sort!
    : 'name'

  const s = db()
console.log('[CATEGORY] Reached database client setup:', Date.now())
  // Start measuring the server-side Supabase request.
  const startTime = Date.now()

  let query = s
    .from('categories')
    .select(`
      id,
      name,
      items (
        id,
        name,
        quantity,
        image_path
      )
    `)
    .eq('id', params.id)
    .eq('items.is_active', true)

  if (q) {
    query = query.ilike('items.name', `%${q}%`)
  }

  const { data: cat, error } = await query.single()

  // Log the time taken by the Supabase API request.
  console.log(
    '[CATEGORY] Supabase query duration:',
    Date.now() - startTime,
    'ms'
  )

  if (error || !cat || cat.name === 'Archived Items') notFound()

  const items = (cat.items ?? []).sort((a, b) => {
    if (sort === 'qty-asc') return a.quantity - b.quantity
    if (sort === 'qty-desc') return b.quantity - a.quantity
    return a.name.localeCompare(b.name)
  })
console.log(
  '[CATEGORY] Total server processing before render:',
  Date.now() - startTime,
  'ms'
)
  return (
    <section>
      <Link href="/" className="text-sm text-brand hover:underline">
        Back to home
      </Link>

      <h1 className="mb-4 mt-1 text-xl font-semibold">{cat.name}</h1>

      <form className="mb-6 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search this category"
          className="field max-w-xs"
          aria-label="Search this category"
          maxLength={60}
        />

        <select
          name="sort"
          defaultValue={sort}
          className="field w-auto"
          aria-label="Sort items"
        >
          <option value="name">Name, A to Z</option>
          <option value="qty-desc">Quantity, high to low</option>
          <option value="qty-asc">Quantity, low to high</option>
        </select>

        <button className="btn">Apply</button>
      </form>

      <div className="mx-auto grid justify-center gap-6 [grid-template-columns:repeat(auto-fill,160px)]">
        {items.map((i) => (
          <ItemCard key={i.id} item={i} />
        ))}
      </div>

      {!items.length && (
        <p className="text-center text-sm text-ink/60">
          No items in this category
          {q ? ' match your search' : ' yet'}.
        </p>
      )}
    </section>
  )
}
