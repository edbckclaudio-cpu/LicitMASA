import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Cria um cliente administrativo para validar a conectividade do service role.
 *
 * @returns Cliente Supabase administrativo ou null quando faltar configuracao.
 */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

/**
 * Verifica se o ambiente do servidor consegue abrir um cliente administrativo
 * do Supabase e consultar a tabela `profiles`.
 *
 * Uso principal:
 * - depurar falhas de cron e rotas administrativas;
 * - confirmar que `SUPABASE_SERVICE_ROLE_KEY` esta presente e funcional.
 *
 * @returns Flags de presenca de ambiente e resultado da consulta de teste.
 */
export async function GET() {
  try {
    const present = {
      NEXT_PUBLIC_SUPABASE_URL: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
      SUPABASE_SERVICE_ROLE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || '').trim(),
    }
    const admin = adminClient()
    if (!admin) {
      return NextResponse.json({ ok: false, present, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    }
    try {
      await admin.from('profiles').select('id').limit(1)
    } catch (e: any) {
      return NextResponse.json({ ok: false, present, error: e?.message || 'ADMIN_QUERY_FAILED' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, present })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
