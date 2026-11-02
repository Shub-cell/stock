
import { requireAdmin, imgUrl } from '@/lib/supabase/server'
import Confirm from '@/components/Confirm'
import { addCategory, addItem, deleteCategory, deleteItem, setQuantity } from './actions'
import { approveOrder, rejectOrder } from './order-actions'

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export default async function Admin({
  searchParams,
}: {
  searchParams: { err?: string; order_msg?: string }
}) {
  const { s } = await requireAdmin()

  const [
    { data: cats },
    { data: items },
    { data: orders, error: ordersError },
  ] = await Promise.all([
    s.from('categories').select('id, name').order('name'),

    // Only show active items in the admin inventory.
    s.from('items')
      .select(
        'id, name, quantity, image_path, created_at, updated_at, is_active, categories(name)'
      )
      .eq('is_active', true)
      .order('updated_at', { ascending: false }),

    s.from('orders')
      .select(
        'id, user_id, status, created_at, customer_name, customer_email, order_items(id, item_name, quantity)'
      )
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const total = (items ?? []).reduce((n, i) => n + i.quantity, 0)

  const stats: [string, number][] = [
    ['Categories', cats?.length ?? 0],
    ['Items', items?.length ?? 0],
    ['Units in stock', total],
  ]

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Manage inventory</h1>

      {searchParams.err && (
        <p
          role="alert"
          className="rounded bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {searchParams.err.slice(0, 160)}
        </p>
      )}

      {searchParams.order_msg && (
        <p
          role="status"
          className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-900"
        >
          {searchParams.order_msg.slice(0, 300)}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {stats.map(([k, v]) => (
          <div key={k} className="panel px-4 py-3">
            <p className="text-xs text-ink/60">{k}</p>
            <p className="text-xl font-semibold">{v.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Order requests</h2>
          <span className="text-xs text-ink/60">
            Approve to reduce stock; reject to leave stock unchanged.
          </span>
        </div>

        {ordersError ? (
          <p className="text-sm text-ink/60">
            Order system is not set up yet. Run{' '}
            <code>supabase/order-system-migration.sql</code> in the Supabase SQL
            Editor.
          </p>
        ) : !orders?.length ? (
          <p className="text-sm text-ink/60">No order requests yet.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o: any) => (
              <article
                key={o.id}
                className="rounded-lg border border-rule p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {o.customer_name || o.customer_email || 'User order'}
                    </p>
                    <p className="mt-1 text-xs text-ink/50">
                      {o.customer_email || ''} ·{' '}
                      {new Date(o.created_at).toLocaleString('en-IN')} ·{' '}
                      {o.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      o.status === 'approved'
                        ? 'bg-green-50 text-green-800'
                        : o.status === 'rejected'
                          ? 'bg-red-50 text-red-800'
                          : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    {o.status === 'pending'
                      ? 'Pending approval'
                      : o.status[0].toUpperCase() + o.status.slice(1)}
                  </span>
                </div>

                <ul className="mt-3 space-y-1 text-sm">
                  {(o.order_items ?? []).map((it: any) => (
                    <li
                      key={it.id}
                      className="flex justify-between gap-3"
                    >
                      <span>{it.item_name}</span>
                      <span>× {it.quantity}</span>
                    </li>
                  ))}
                </ul>

                {o.status === 'pending' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={approveOrder}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="btn">Approve order</button>
                    </form>

                    <form
                      action={rejectOrder}
                      className="flex flex-1 gap-2"
                    >
                      <input type="hidden" name="id" value={o.id} />
                      <input
                        name="reason"
                        maxLength={300}
                        placeholder="Optional rejection reason"
                        className="field min-w-0"
                        aria-label="Optional rejection reason"
                      />
                      <button className="btn-quiet">Reject</button>
                    </form>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <form action={addCategory} className="panel space-y-3 p-4">
          <h2 className="font-medium">Add category</h2>

          <input
            name="name"
            required
            maxLength={60}
            placeholder="Category name"
            className="field"
            aria-label="Category name"
          />

          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm"
            aria-label="Category image"
          />

          <button className="btn">Add category</button>
        </form>

        <form action={addItem} className="panel space-y-3 p-4">
          <h2 className="font-medium">Add item</h2>

          <input
            name="name"
            required
            maxLength={100}
            placeholder="Item name"
            className="field"
            aria-label="Item name"
          />

          <div className="flex gap-2">
            <select
              name="category_id"
              required
              className="field"
              aria-label="Category"
            >
              {(cats ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <input
              name="quantity"
              type="number"
              min={0}
              max={1000000}
              defaultValue={0}
              required
              className="field w-28"
              aria-label="Quantity"
            />
          </div>

          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm"
            aria-label="Item image"
          />

          <button className="btn" disabled={!cats?.length}>
            Add item
          </button>
        </form>
      </div>

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-rule text-xs text-ink/60">
            <tr>
              {[
                'Image',
                'Name',
                'Category',
                'Quantity',
                'Added',
                'Updated',
                '',
              ].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {(items ?? []).map((i) => {
              const src = imgUrl(i.image_path)
              const cat = Array.isArray(i.categories)
                ? i.categories[0]
                : i.categories

              return (
                <tr
                  key={i.id}
                  className="border-b border-rule last:border-0"
                >
                  <td className="px-3 py-2">
                    <div className="h-10 w-10 overflow-hidden rounded bg-paper">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {src && (
                        <img
                          src={src}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  </td>

                  <td className="px-3 py-2 font-medium">{i.name}</td>
                  <td className="px-3 py-2">{cat?.name}</td>

                  <td className="px-3 py-2">
                    <form action={setQuantity} className="flex gap-1">
                      <input
                        type="hidden"
                        name="id"
                        value={i.id}
                      />
                      <input
                        name="quantity"
                        type="number"
                        min={0}
                        max={1000000}
                        defaultValue={i.quantity}
                        className="field w-20"
                        aria-label={`Quantity of ${i.name}`}
                      />
                      <button className="btn-quiet px-3">Save</button>
                    </form>
                  </td>

                  <td className="px-3 py-2 text-ink/60">
                    {fmt(i.created_at)}
                  </td>

                  <td className="px-3 py-2 text-ink/60">
                    {fmt(i.updated_at)}
                  </td>

                  <td className="px-3 py-2">
                    <form action={deleteItem}>
                      <input
                        type="hidden"
                        name="id"
                        value={i.id}
                      />
                      <Confirm
                        label="Delete"
                        message={`Delete “${i.name}”? This cannot be undone.`}
                      />
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!items?.length && (
          <p className="p-4 text-sm text-ink/60">
            No items yet. Add a category, then add your first item.
          </p>
        )}
      </section>

      {!!cats?.length && (
        <section className="panel p-4">
          <h2 className="mb-2 font-medium">Categories</h2>

          <ul className="divide-y divide-rule text-sm">
            {cats.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between py-2"
              >
                {c.name}

                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <Confirm
                    label="Delete"
                    message={`Delete the category “${c.name}”? It must be empty.`}
                  />
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
