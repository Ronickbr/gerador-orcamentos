'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/types/actions'

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  const target = email.trim().toLowerCase()
  if (!target) return { ok: false, error: 'Informe seu e-mail.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(target)

  if (error) return { ok: false, error: error.message }

  // Resposta idêntica para e-mail existente ou não (evita enumeração).
  return { ok: true, data: null }
}

export async function setNewPassword(password: string): Promise<ActionResult> {
  if (password.length < 8) {
    return { ok: false, error: 'A senha deve ter ao menos 8 caracteres.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Link expirado. Solicite uma nova redefinição de senha.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, error: error.message }

  return { ok: true, data: null }
}
