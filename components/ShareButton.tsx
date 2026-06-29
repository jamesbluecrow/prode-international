'use client'
import { useState } from 'react'

interface Props {
  code: string
}

export function ShareButton({ code }: Props) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = `${window.location.origin}/join/${code}`
    if (navigator.share) {
      await navigator.share({ title: 'Unirse a mi prode', url })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={share}
      className="w-full py-3 rounded-xl font-bold text-[var(--bg)] text-sm uppercase tracking-widest transition-opacity hover:opacity-90"
      style={{ background: 'linear-gradient(90deg, var(--gold) 0%, var(--gold-2) 100%)' }}
    >
      {copied ? '✓ Link copiado' : 'Compartir'}
    </button>
  )
}
