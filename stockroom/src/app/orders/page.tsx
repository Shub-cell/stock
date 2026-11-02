import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/supabase/server'

const dateFmt = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const label = (status: string) => status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending approval'

export default async function MyOrders() {
  const s = db()
  const { data: { user } } = await s.auth.getUser()
  if (!user) redirect('/login')
  const { data: orders, error } = await s.from('orders').select('id, status, created_at, reviewed_at, rejection_reason, order_items(id, item_name, quantity)').order('created_at', { ascending: false })
  return <section className="mx-auto max-w-3xl"><Link href="/" className="text-sm text-brand hover:underline">← Back to categories</Link><h1 className="mb-5 mt-2 text-xl font-semibold">My order requests</h1>{error ? <p role="alert" className="panel p-4 text-sm">Could not load orders. Apply the order-system SQL migration in Supabase, then refresh.</p> : !orders?.length ? <div className="panel p-8 text-center"><p className="font-medium">No order requests yet</p><Link href="/" className="btn mt-4">Browse categories</Link></div> : <div className="space-y-4">{orders.map(order => <article key={order.id} className="panel p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">Order request</p><p className="mt-1 text-xs text-ink/50">{dateFmt(order.created_at)} · {order.id.slice(0, 8).toUpperCase()}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${order.status === 'approved' ? 'bg-green-50 text-green-800' : order.status === 'rejected' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>{label(order.status)}</span></div><ul className="mt-3 space-y-1 border-t border-rule pt-3 text-sm">{(order.order_items ?? []).map((item: {id:string;item_name:string;quantity:number}) => <li key={item.id} className="flex justify-between gap-3"><span>{item.item_name}</span><span>× {item.quantity}</span></li>)}</ul>{order.rejection_reason && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">Reason: {order.rejection_reason}</p>}</article>)}</div>}</section>
}
