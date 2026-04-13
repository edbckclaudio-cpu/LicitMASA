import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Forca a sincronizacao administrativa de um `subscription_id` no profile.
 *
 * Uso principal:
 * - suporte manual quando o bootstrap cliente nao conseguiu gravar o token;
 * - correcoes operacionais para usuario identificado por `userId` ou `email`;
 * - validacao de integridade do vinculo entre conta e OneSignal.
 *
 * Requer `x-admin-token`.
 *
 * @param req Requisicao com `userId` ou `email` e o `subscriptionId`.
 * @returns Resultado da atualizacao e snapshot do profile apos a operacao.
 */
export async function POST(req: Request) {
  try {
    const adminToken = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!adminToken || adminToken !== expected) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({} as any))
    const userId = String(body.userId || '').trim()
    const email = String(body.email || '').trim().toLowerCase() || null
    const subscriptionId = String(body.subscriptionId || body.onesignalId || '').trim()
    if (!userId && !email) {
      return NextResponse.json({ ok: false, error: 'MISSING_USER' }, { status: 400 })
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) {
      return NextResponse.json({ ok: false, error: 'ADMIN_NOT_CONFIGURED' }, { status: 500 })
    }
    const supa = createClient(url, key)
    let uid = userId
    if (!uid && email) {
      const { data } = await supa.from('profiles').select('id').eq('email', email).limit(1).maybeSingle()
      uid = String((data as any)?.id || '')
    }
    if (!uid) {
      return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 })
    }
    if (email) {
      try {
        await supa.from('profiles').upsert({ id: uid, email }, { onConflict: 'id' })
      } catch {}
    }
    let updated = false
    let err: string | null = null
    try {
      const u1 = await supa.from('profiles').update({
        subscription_id: subscriptionId || null,
      }).eq('id', uid)
      if (u1?.error) err = String(u1.error.message || 'UPDATE_ERROR')
      else updated = true
    } catch (e: any) { err = String(e?.message || 'UPDATE_THROWN') }
    const { data: prof } = await supa.from('profiles').select('id,email,subscription_id').eq('id', uid).limit(1).maybeSingle()
    return NextResponse.json({ ok: true, updated, error: err, profile: prof || null })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
