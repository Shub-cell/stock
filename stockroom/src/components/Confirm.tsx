'use client'
export default function Confirm({ label, message }: { label: string; message: string }) {
  return (
    <button className="text-sm text-red-700 hover:underline"
      onClick={(e) => { if (!confirm(message)) e.preventDefault() }}>{label}</button>
  )
}
