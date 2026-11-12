'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        setError(signOutError.message)
        setLoading(false)
        return
      }
      router.replace('/login')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao sair.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span>{loading ? 'Saindo...' : 'Sair'}</span>
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}
