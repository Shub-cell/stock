import Link from 'next/link'
import { register } from '../auth-actions'

export default function Page({ searchParams }: { searchParams: { err?: string; msg?: string } }) {
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <form action={register} className="panel space-y-4 p-6">
        <h1 className="text-lg font-semibold">Create account</h1>
        {searchParams.err && <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{searchParams.err.slice(0, 120)}</p>}
        {searchParams.msg && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{searchParams.msg.slice(0, 160)}</p>}
        <label className="block text-sm">Full name<input name="name" className="field mt-1" maxLength={100} autoComplete="name" /></label>
        <label className="block text-sm">Email<input name="email" type="email" required className="field mt-1" autoComplete="email" /></label>
        <label className="block text-sm">Password<input name="password" type="password" required className="field mt-1" autoComplete="new-password" minLength={12} /></label>
        <button className="btn w-full">Create account</button>
        <p className="text-center text-sm"><Link href="/login" className="text-brand hover:underline">I already have an account</Link></p>
      </form>
    </div>
  )
}
