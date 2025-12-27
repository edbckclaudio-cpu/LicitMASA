'use server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

async function sendPush(externalUserId: string, subject: string, message: string, url?: string) {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
  const apiKey = process.env.ONESIGNAL_API_KEY || ''
  if (!appId || !apiKey || !externalUserId) return { ok: false, status: 400, error: 'CONFIG_OR_USER_MISSING' }
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: appId,
      include_external_user_ids: [externalUserId],
      headings: { en: subject },
      contents: { en: message },
      url: url || process.env.NEXT_PUBLIC_SITE_URL || 'https://pncp.gov.br/',
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url)
    const email = String(u.searchParams.get('email') || '').trim().toLowerCase()
    const userIdParam = String(u.searchParams.get('userId') || '').trim()
    const subject = String(u.searchParams.get('subject') || 'Teste de Push').trim()
    const message = String(u.searchParams.get('message') || 'Este é um teste de notificação do LicitMASA').trim()
    let externalUserId = userIdParam
    if (!externalUserId && email) {
      const supa = admin()
      if (!supa) return NextResponse.json({ ok: false, error: 'ADMIN_NOT_CONFIGURED' }, { status: 500 })
      let page = 1
      const perPage = 200
      while (page < 200 && !externalUserId) {
        const { data, error } = await supa.auth.admin.listUsers({ page, perPage })
        if (error) break
        const found = (data?.users || []).find((u: any) => String(u?.email || '').toLowerCase() === email)
        if (found?.id) externalUserId = String(found.id)
        page++
      }
    }
    if (!externalUserId) return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 400 })
    const pr = await sendPush(externalUserId, subject, message)
    return NextResponse.json({ ok: pr.ok, status: pr.status, data: pr.data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
