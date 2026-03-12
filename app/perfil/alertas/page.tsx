'use client'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Accordion } from '@/components/ui/accordion'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Info } from 'lucide-react'
declare const OneSignal: any
declare global { interface Window { OneSignal: any } }

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export default function AlertasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [appIdCfg, setAppIdCfg] = useState<string | null>(null)
  const [keywordsInput, setKeywordsInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [ufs, setUfs] = useState<string[]>([])
  const [minValue, setMinValue] = useState<string>('')
  const [ativo, setAtivo] = useState(true)
  const [pushOn, setPushOn] = useState(true)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [uiMsg, setUiMsg] = useState<string | null>(null)
  const [permWeb, setPermWeb] = useState<string | null>(null)
  const [permOS, setPermOS] = useState<string | null>(null)
  const [statusDelayOk, setStatusDelayOk] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [osExternalId, setOsExternalId] = useState<string | null>(null)
  const [osPlayerId, setOsPlayerId] = useState<string | null>(null)
  const [dbPlayerId, setDbPlayerId] = useState<string | null>(null)
  const [profileOnesignalId, setProfileOnesignalId] = useState<string | null>(null)
  const [initErrorTop, setInitErrorTop] = useState<string | null>(null)
  const [swRegistered, setSwRegistered] = useState<boolean>(false)
  const [swScope, setSwScope] = useState<string | null>(null)
  const [lastPayloadSent, setLastPayloadSent] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [lastSentExternalId, setLastSentExternalId] = useState<string | null>(null)
  const [lastSentPlayerId, setLastSentPlayerId] = useState<string | null>(null)
  const [lastSentUserId, setLastSentUserId] = useState<string | null>(null)
  const [lastSentRecipients, setLastSentRecipients] = useState<number | null>(null)
  const [lastSentStatus, setLastSentStatus] = useState<number | null>(null)
  const [originSecure, setOriginSecure] = useState<boolean>(true)
  const [isSecureCtx, setIsSecureCtx] = useState<boolean>(true)
  const [originInfo, setOriginInfo] = useState<string>('—')
  const [swWorkerReachable, setSwWorkerReachable] = useState<string>('desconhecido')
  const [swManualRegMsg, setSwManualRegMsg] = useState<string | null>(null)
  const [assetLinksStatus, setAssetLinksStatus] = useState<string>('desconhecido')
  const [diagRunning, setDiagRunning] = useState<boolean>(false)
  const [diagItems, setDiagItems] = useState<Array<{ id: string, label: string, ok: boolean, detail?: string }>>([])
  
  const isGranted = useMemo(() => (permOS === 'granted' || permWeb === 'granted' || !!osPlayerId), [permOS, permWeb, osPlayerId])

  

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError(null)
      if (!supabase) { setError('Configure o Supabase'); setLoading(false); return }
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data: prof, error: profErr } = await supabase.from('profiles').select('is_premium, plan, subscription_id, email').eq('id', user.id).single()
      const allow = String(process.env.NEXT_PUBLIC_PREMIUM_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
      const email = String(user.email || '').toLowerCase()
      const premium = Boolean(prof?.is_premium) || String(prof?.plan || '').toLowerCase() === 'premium' || allow.includes(email)
      setIsPremium(premium)
      try {
        const pidFromProfile = String((prof as any)?.subscription_id || '')
        if (pidFromProfile) {
          setProfileOnesignalId(pidFromProfile)
          setDbPlayerId(pidFromProfile)
        }
      } catch {}
      try {
        const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
        if (OneSignal) {
          const ext = user.email || user.id
          await OneSignal?.login?.(ext)
          try {
            const extNow = OneSignal?.User?.externalId
            if (extNow) setOsExternalId(String(extNow))
          } catch {}
          try {
            const pidNow = OneSignal?.User?.PushSubscription?.id
            if (pidNow) setOsPlayerId(String(pidNow))
          } catch {}
        }
      } catch {}
      // Evitar 404 na ausência da tabela user_alerts neste projeto: usar apenas localStorage
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(`user_alerts:${user.id}`) || ''
          const j = raw ? JSON.parse(raw) : null
          if (j && typeof j === 'object') {
            setKeywords(Array.isArray(j.keywords) ? j.keywords.filter((x: any) => typeof x === 'string') : [])
            setUfs(Array.isArray(j.ufs) ? j.ufs.filter((x: any) => typeof x === 'string') : [])
            setMinValue(j.valor_minimo ? String(j.valor_minimo) : '')
            setAtivo(Boolean(j.ativo))
            setPushOn(Boolean(j.push_notificacao))
          }
        } catch {}
      }
      setLoading(false)
      try { await refreshOneSignalInfo() } catch {}
    }
    init()
  }, [router])
  useEffect(() => {
    const check = async () => {
      try {
        if (!('serviceWorker' in navigator)) { setSwRegistered(false); setSwScope(null); return }
        const regs = await navigator.serviceWorker.getRegistrations()
        let found = false
        let scope: string | null = null
        for (const r of regs) {
          const s1 = (r.active && (r.active as any).scriptURL) || ''
          const s2 = (r.installing && (r.installing as any).scriptURL) || ''
          const s3 = (r.waiting && (r.waiting as any).scriptURL) || ''
          const has = [s1, s2, s3].some((u) => typeof u === 'string' && /OneSignalSDKWorker\.js/i.test(u))
          if (has) { found = true; scope = r.scope; break }
        }
        setSwRegistered(found)
        setSwScope(scope)
      } catch {
        setSwRegistered(false)
        setSwScope(null)
      }
    }
    check()
  }, [])
  useEffect(() => {
    try {
      const run = async () => {
        if (supabase && userId && osPlayerId) {
          try {
            const sess = await supabase.auth.getSession()
            const jwt = String(sess?.data?.session?.access_token || '')
            if (jwt) {
              const r = await fetch('/api/profile/sync-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
                body: JSON.stringify({ subscriptionId: String(osPlayerId) })
              })
              if (r.ok) { try { setDbPlayerId(String(osPlayerId)) } catch {} }
            }
          } catch {}
        }
      }
      run()
    } catch {}
  }, [userId, osPlayerId])
  useEffect(() => {
    try {
      const t = setTimeout(() => { try { setStatusDelayOk(true) } catch {} }, 3000)
      return () => { try { clearTimeout(t) } catch {} }
    } catch {}
    try {
      const msg = typeof window !== 'undefined' ? (window as any).__ONE_SIGNAL_INIT_ERROR : null
      setInitErrorTop(msg ? String(msg) : null)
    } catch {
      setInitErrorTop(null)
    }
    try {
      const p = typeof Notification !== 'undefined' ? Notification.permission : undefined
      setPermWeb(p || null)
    } catch {
      setPermWeb(null)
    }
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      const p = OneSignal?.Notifications?.permission
      setPermOS(p || null)
    } catch {
      setPermOS(null)
    }
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      const handler = (permission?: any) => {
        try {
          const p = permission ?? OneSignal?.Notifications?.permission
          setPermOS(p || null)
          try {
            const permNative = typeof Notification !== 'undefined' ? Notification.permission : null
            console.log('[Diag] Permissão navegador=', permNative, 'OneSignal=', p)
          } catch {}
          const liveId = (OneSignal as any)?.User?.pushSubscriptionId
          if (liveId) {
            setOsPlayerId(String(liveId))
            saveSubscriptionIdToProfile(String(liveId))
            ensureSubscriptionReady()
          }
        } catch {}
      }
      OneSignal?.Notifications?.addEventListener?.('permissionChange', handler)
      OneSignal?.User?.addEventListener?.('subscriptionChange', () => {
        try {
          const pid = (OneSignal as any)?.User?.pushSubscriptionId
          if (pid) {
            setOsPlayerId(String(pid))
            saveSubscriptionIdToProfile(String(pid))
            ensureSubscriptionReady()
          }
        } catch {}
      })
      return () => {
        try { OneSignal?.Notifications?.removeEventListener?.('permissionChange', handler) } catch {}
      }
    } catch {}
    try {
      const isHttps = typeof location !== 'undefined' ? location.protocol === 'https:' : false
      const host = typeof location !== 'undefined' ? location.hostname : ''
      const isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(host)
      setOriginSecure(Boolean(isHttps || isLocalhost))
      try { setIsSecureCtx(Boolean(typeof window !== 'undefined' ? (window as any).isSecureContext : true)) } catch { setIsSecureCtx(true) }
      try { setOriginInfo(String(typeof location !== 'undefined' ? (location.protocol + '//' + location.host) : '—')) } catch { setOriginInfo('—') }
    } catch {
      setOriginSecure(true)
    }
    async function loadOneSignalInfo() {
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      if (!OneSignal) return
      let ext: any = null
      let pid: any = null
      try { ext = OneSignal?.User?.externalId } catch {}
      if (!ext) { try { ext = await OneSignal?.getExternalUserId?.() } catch {} }
      setOsExternalId(ext ? String(ext) : null)
      try { pid = OneSignal?.User?.PushSubscription?.id } catch {}
      if (!pid) { try { pid = await OneSignal?.getSubscriptionId?.() } catch {} }
      setOsPlayerId(pid ? String(pid) : null)
      if (!pid && userId) {
        try {
          if (supabase) {
            const { data: prof2 } = await supabase.from('profiles').select('subscription_id').eq('id', userId).limit(1).maybeSingle()
            const t = String((prof2 as any)?.subscription_id || '')
            if (t) setOsPlayerId(t || null)
          }
        } catch {}
      }
    } catch {}
  }
  loadOneSignalInfo()
  }, [userId])
  

  async function runDiagnostics() {
    try {
      setDiagRunning(true)
      const results: Array<{ id: string, label: string, ok: boolean, detail?: string }> = []
      // 1) Conexão Base
      try {
        const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
        const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const baseOk = Boolean(envUrl && envKey && supabase)
        results.push({
          id: 'base',
          label: 'Conexão Supabase (URL/KEY no cliente)',
          ok: baseOk,
          detail: `URL: ${envUrl ? 'ok' : 'faltando'} | KEY: ${envKey ? 'ok' : 'faltando'}`
        })
      } catch (e: any) {
        results.push({ id: 'base', label: 'Conexão Supabase (URL/KEY no cliente)', ok: false, detail: String(e?.message || e) })
      }
      // 2) Verificação de Profile
      let uid: string | null = null
      try {
        const ud = await supabase?.auth.getUser()
        uid = ud?.data?.user?.id || null
        if (!uid) {
          results.push({ id: 'profile', label: 'Profile (select pelo uid atual)', ok: false, detail: 'Usuário não logado' })
        } else {
          const sel = await supabase!.from('profiles').select('id').eq('id', uid).limit(1).maybeSingle()
          const ok = Boolean((sel as any)?.data?.id)
          const detail = ok ? `id=${(sel as any)?.data?.id}` : ((sel as any)?.error?.message || 'Não encontrado')
          results.push({ id: 'profile', label: 'Profile (select pelo uid atual)', ok, detail })
        }
      } catch (e: any) {
        results.push({ id: 'profile', label: 'Profile (select pelo uid atual)', ok: false, detail: String(e?.message || e) })
      }
      // 3) Status OneSignal
      try {
        const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
        let externalId: string | null = null
        let subscriptionId: string | null = null
        try { externalId = OneSignal?.User?.externalId || null } catch {}
        if (!externalId) { try { externalId = await OneSignal?.getExternalUserId?.() } catch {} }
        try { subscriptionId = OneSignal?.User?.PushSubscription?.id || null } catch {}
        if (!subscriptionId) { try { subscriptionId = await OneSignal?.getSubscriptionId?.() } catch {} }
        const ok = Boolean(externalId || subscriptionId)
        let detail = ''
        try {
          const { data: u } = await supabase!.auth.getUser()
          const email = String(u?.user?.email || '')
          const uidNow = String(u?.user?.id || '')
          detail = `externalId: ${externalId || '—'} (uid esperado: ${uidNow}); subscriptionId: ${subscriptionId || '—'}; email: ${email || '—'}`
        } catch {
          detail = `externalId: ${externalId || '—'}; subscriptionId: ${subscriptionId || '—'}`
        }
        results.push({ id: 'onesignal', label: 'OneSignal (externalId/subscriptionId)', ok, detail })
      } catch (e: any) {
        results.push({ id: 'onesignal', label: 'OneSignal (externalId/subscriptionId)', ok: false, detail: String(e?.message || e) })
      }
      // 4) Teste de Escrita Real (INSERT e DELETE efêmero)
      try {
        if (!uid) {
          const ud = await supabase?.auth.getUser()
          uid = ud?.data?.user?.id || null
        }
        if (!uid) {
          results.push({ id: 'write', label: 'Escrita efêmera em search_alerts', ok: false, detail: 'Usuário não logado' })
        } else {
          const temp = `TESTE_DIAGNOSTICO_${Date.now()}`
          const ins = await supabase!.from('search_alerts').insert({ user_id: uid, keyword: temp, active: false } as any)
          if ((ins as any)?.error) {
            const msg = String((ins as any).error?.message || 'INSERT_ERROR')
            const code = String((ins as any).error?.code || '')
            results.push({ id: 'write', label: 'Escrita efêmera em search_alerts', ok: false, detail: `${msg}${code ? ` (code: ${code})` : ''}` })
          } else {
            try { await supabase!.from('search_alerts').delete().eq('user_id', uid).eq('keyword', temp) } catch {}
            results.push({ id: 'write', label: 'Escrita efêmera em search_alerts', ok: true, detail: 'INSERT/DELETE ok' })
          }
        }
      } catch (e: any) {
        const msg = String(e?.message || e)
        results.push({ id: 'write', label: 'Escrita efêmera em search_alerts', ok: false, detail: msg })
      }
      setDiagItems(results)
    } catch {
      setDiagItems((prev) => prev.length ? prev : [{ id: 'fatal', label: 'Erro ao rodar diagnóstico', ok: false, detail: 'Desconhecido' }])
    } finally {
      setDiagRunning(false)
    }
  }

  async function handleTestAndDiagnose() {
    try {
      setTestLoading(true)
      await runDiagnostics()
      await sendTestNotification()
    } finally {
      setTestLoading(false)
    }
  }

  async function sendTestNotification() {
    try {
      setUiMsg(null)
      setError(null)
      setTestLoading(true)
      setUiMsg('Preparando envio de teste...')
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        setError('Ative as notificações no navegador')
        setTestLoading(false)
        return
      }
      if (!userId) {
        setError('Entre para testar notificações')
        setTestLoading(false)
        return
      }
      let playerIdToUse = osPlayerId || null
      let externalIdToUse = osExternalId || null
      if (!externalIdToUse) {
        try {
          externalIdToUse = (typeof window !== 'undefined' ? (window as any).OneSignal?.User?.externalId : null) || null
        } catch {}
      }
      if (!playerIdToUse) {
        try {
          playerIdToUse = (typeof window !== 'undefined' ? (window as any).OneSignal?.User?.pushSubscriptionId : null) || null
          if (playerIdToUse) {
            try { setOsPlayerId(String(playerIdToUse)) } catch {}
            try { await saveSubscriptionIdToProfile(String(playerIdToUse)) } catch {}
          }
        } catch {}
      }
      if (!playerIdToUse) {
        try {
          if (supabase) {
            const { data: prof } = await supabase.from('profiles').select('subscription_id').eq('id', userId).limit(1).maybeSingle()
            const p = String((prof as any)?.subscription_id || '')
            if (p) playerIdToUse = p
            if (!p) {
              const got = await ensureSubscriptionReady()
              if (got) playerIdToUse = got
            }
          }
        } catch {}
      }
      if (!playerIdToUse) {
        try {
          if (supabase) {
            const { data: prof2 } = await supabase.from('profiles').select('subscription_id').eq('id', userId).limit(1).maybeSingle()
            const t = String((prof2 as any)?.subscription_id || '')
            if (t) playerIdToUse = t
          }
        } catch {}
      }
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
        body: (() => {
          if (!playerIdToUse) {
            try { OneSignal?.User?.pushSubscription?.optIn?.() } catch {}
          }
          const payload = {
            userId,
            externalId: externalIdToUse || undefined,
            subscriptionId: playerIdToUse || undefined,
            priority: 10,
          }
          try { setLastPayloadSent(payload) } catch {}
          try {
            setLastSentExternalId(externalIdToUse || null)
            setLastSentPlayerId(playerIdToUse || null)
            setLastSentUserId(userId || null)
          } catch {}
          return JSON.stringify(payload)
        })(),
      })
      try {
        const raw = await res.clone().text()
        let data: any = null
        try { data = JSON.parse(raw) } catch {}
        const sentExternal = externalIdToUse || userId
        const recipients = typeof data?.recipients === 'number' ? data.recipients : null
        try {
          setLastSentRecipients(recipients ?? null)
          setLastSentStatus(res.status || null)
        } catch {}
        const payloadToShow = {
          status: res.status,
          recipients,
          externalIdUsed: sentExternal,
          equalsTarget: String(sentExternal) === 'f3f3f88f-6f29-4171-85b2-320d74f26b2b',
          data: data ?? raw,
        }
        alert(JSON.stringify(payloadToShow, null, 2))
        try { console.log('OneSignal test response', payloadToShow) } catch {}
      } catch {}
      if (res.ok) {
        setUiMsg('Notificação enviada')
      } else {
        try {
          const errRaw = await res.clone().text()
          let msg = errRaw
          try {
            const err = JSON.parse(errRaw)
            msg = typeof err?.error === 'string' ? err.error : JSON.stringify(err?.error || err)
          } catch {}
          setUiMsg('Falha ao enviar: ' + msg)
          try { alert('Falha ao enviar: ' + msg) } catch {}
        } catch {
          setUiMsg('Falha ao enviar notificação')
          try { alert('Falha ao enviar notificação') } catch {}
        }
      }
    } catch {
      setUiMsg('Falha ao enviar notificação')
      try { alert('Falha ao enviar notificação') } catch {}
    } finally {
      setTestLoading(false)
    }
  }
  async function sendTestNotificationDelayed() {
    try {
      alert('Bloqueie a tela!')
      setUiMsg(null)
      setError(null)
      const uidCaptured = userId
      if (!uidCaptured) { setError('Usuário não logado'); return }
      try { console.log('Preparando envio em 10 segundos para usuário:', uidCaptured) } catch {}
      const updates = ['Enviando em 3...', 'Enviando em 2...', 'Enviando em 1...']
      try {
        setTimeout(() => { try { setUiMsg(updates[0]) } catch {} }, 7000)
        setTimeout(() => { try { setUiMsg(updates[1]) } catch {} }, 8000)
        setTimeout(() => { try { setUiMsg(updates[2]) } catch {} }, 9000)
      } catch {}
      setTimeout(async () => {
        try {
          const subscriptionId = (typeof window !== 'undefined' ? (window as any).OneSignal?.User?.pushSubscriptionId : null) || null
          const uid = uidCaptured
          const res = await fetch('/api/notifications/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
            body: (() => {
              const payload = {
                userId: uid,
                subscriptionId: subscriptionId || undefined,
                externalId: (typeof window !== 'undefined' ? (window as any).OneSignal?.User?.externalId : null) || undefined,
                priority: 10,
              }
              try { setLastPayloadSent(payload) } catch {}
              return JSON.stringify(payload)
            })(),
          })
          try { console.log('Disparo agendado concluído', { status: res.status, ok: res.ok, subscriptionId }) } catch {}
        } catch (err: any) {
          try { console.error('Erro no disparo agendado:', err?.message || String(err)) } catch {}
        }
      }, 10000)
    } catch {
      setUiMsg('Falha ao agendar envio')
    }
  }
  useEffect(() => {
    const run = async () => {
      try { await checkWorkerReachability() } catch {}
      try {
        const r = await fetch('/.well-known/assetlinks.json', { method: 'GET' })
        setAssetLinksStatus(r.ok ? 'ok' : `erro ${r.status}`)
      } catch (e: any) {
        setAssetLinksStatus(`falha ${e?.message || 'UNKNOWN'}`)
      }
    }
    run()
  }, [])
  const saveSubscriptionIdToProfile = useCallback(async (id: string) => {
    try {
      if (supabase && userId && id) {
        await supabase.from('profiles').update({ subscription_id: String(id) }).eq('id', userId)
      }
    } catch {}
  }, [userId])
  async function ensureSubscriptionReady() {
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      let attempts = 0
      let pid: string | null = null
      while (attempts < 10 && !pid) {
        try {
          const p1 = (OneSignal as any)?.User?.pushSubscriptionId
          const p2 = OneSignal?.User?.PushSubscription?.id
          const p3 = await OneSignal?.getSubscriptionId?.()
          pid = String(p1 || p2 || p3 || '') || null
        } catch {}
        if (!pid) {
          try { await OneSignal?.User?.pushSubscription?.optIn?.() } catch {}
          await new Promise((r) => setTimeout(r, 500))
        }
        attempts++
      }
      if (pid) {
        try { setOsPlayerId(String(pid)) } catch {}
        try { await saveSubscriptionIdToProfile(String(pid)) } catch {}
        return String(pid)
      }
    } catch {}
    return null
  }
  async function activateOneSignal() {
    try {
      setUiMsg(null)
      setError(null)
      if (typeof window === 'undefined') { setError('OneSignal indisponível'); return }
      const OneSignal = (window as any).OneSignal
      if (!OneSignal) { setError('OneSignal não carregado'); return }
      let beforePerm: any = undefined
      try { beforePerm = OneSignal?.Notifications?.permission } catch {}
      let perm: string | undefined
      try { perm = OneSignal?.Notifications?.permission } catch {}
      if (perm === 'granted') {
        setUiMsg('Você já está recebendo alertas!')
        try {
          if (userId) {
            OneSignal.push(function() { 
              try { 
                (async () => { 
                  try { 
                    const ud = await supabase?.auth.getUser()
                    const ext = String(ud?.data?.user?.email || userId)
                    try { OneSignal.login?.(ext) } catch {} 
                  } catch {}
                })()
              } catch {}
            })
          }
          try {
            const ext = OneSignal?.User?.externalId
            if (ext) setOsExternalId(String(ext))
          } catch {}
          try {
            try {
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
                const found = Array.isArray(regs) && regs.some((r: any) => {
                  const s1 = (r.active && (r.active as any).scriptURL) || ''
                  const s2 = (r.installing && (r.installing as any).scriptURL) || ''
                  const s3 = (r.waiting && (r.waiting as any).scriptURL) || ''
                  return [s1, s2, s3].some((u) => typeof u === 'string' && /OneSignalSDKWorker\.js/i.test(u))
                })
                if (found) {
                  await OneSignal?.User?.pushSubscription?.optOut?.()
                  await OneSignal?.User?.pushSubscription?.optIn?.()
                }
              }
            } catch {}
            const liveId = (OneSignal as any)?.User?.pushSubscriptionId
            if (!liveId) {
              await OneSignal?.User?.pushSubscription?.optIn?.()
          }
          const pidNow = (OneSignal as any)?.User?.pushSubscriptionId
          if (pidNow) {
            setOsPlayerId(String(pidNow))
            saveSubscriptionIdToProfile(String(pidNow))
          }
          await ensureSubscriptionReady()
        } catch {}
      } catch {}
      try { console.log('[PermLog] Antes=', beforePerm, 'Depois=', OneSignal?.Notifications?.permission) } catch {}
      return
    }
      try {
        await OneSignal?.Notifications?.requestPermission()
      } catch {}
      try { updatePermStatus() } catch {}
      try {
        const waited = await new Promise<string | undefined>((resolve) => {
          try {
            const handler = () => {
              try { resolve(OneSignal?.Notifications?.permission) } catch { resolve(undefined) }
            }
            OneSignal?.Notifications?.addEventListener?.('permissionChange', handler)
            setTimeout(() => {
              try { OneSignal?.Notifications?.removeEventListener?.('permissionChange', handler) } catch {}
              try { resolve(OneSignal?.Notifications?.permission) } catch { resolve(undefined) }
            }, 1500)
          } catch {
            setTimeout(() => { resolve(undefined) }, 1500)
          }
        })
        perm = waited ?? OneSignal?.Notifications?.permission
      } catch {
        try { perm = OneSignal?.Notifications?.permission } catch {}
      }
      if (perm === 'granted') {
        setUiMsg('Alertas ativados! ✅')
        try {
          if (userId) {
            OneSignal.push(function() { 
              try { 
                (async () => { 
                  try { 
                    const ud = await supabase?.auth.getUser()
                    const ext = String(ud?.data?.user?.email || userId)
                    try { OneSignal.login?.(ext) } catch {} 
                  } catch {}
                })()
              } catch {}
            })
          }
          try {
            const ext = OneSignal?.User?.externalId
            if (ext) setOsExternalId(String(ext))
          } catch {}
          try {
            try {
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
                const found = Array.isArray(regs) && regs.some((r: any) => {
                  const s1 = (r.active && (r.active as any).scriptURL) || ''
                  const s2 = (r.installing && (r.installing as any).scriptURL) || ''
                  const s3 = (r.waiting && (r.waiting as any).scriptURL) || ''
                  return [s1, s2, s3].some((u) => typeof u === 'string' && /OneSignalSDKWorker\.js/i.test(u))
                })
                if (found) {
                  await OneSignal?.User?.pushSubscription?.optOut?.()
                  await OneSignal?.User?.pushSubscription?.optIn?.()
                }
              }
            } catch {}
            const liveId = (OneSignal as any)?.User?.pushSubscriptionId
            if (!liveId) {
              await OneSignal?.User?.pushSubscription?.optIn?.()
          }
          const pidNow = (OneSignal as any)?.User?.pushSubscriptionId
          if (pidNow) {
            setOsPlayerId(String(pidNow))
            saveSubscriptionIdToProfile(String(pidNow))
          }
          await ensureSubscriptionReady()
        } catch {}
      } catch {}
    } else {
      setError('Permissão negada ou não concedida')
    }
      try { console.log('[PermLog] Antes=', beforePerm, 'Depois=', OneSignal?.Notifications?.permission) } catch {}
    } catch {
      setError('Falha ao ativar notificações')
    }
  }
  async function forceBrowserPermission() {
    try {
      const res = await (typeof Notification !== 'undefined' ? Notification.requestPermission() : Promise.resolve(undefined as any))
      try { setPermWeb(res || null) } catch {}
      try { updatePermStatus() } catch {}
      try { await refreshOneSignalInfo() } catch {}
      setUiMsg(res === 'granted' ? 'Permissão do navegador: concedida' : 'Permissão do navegador não concedida')
    } catch {
      setUiMsg('Falha ao solicitar permissão do navegador')
    }
  }
  async function resetAndReinstallNotifications() {
    try {
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map((r) => r.unregister()))
        } catch {}
      }
      try {
        const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
        await OneSignal?.User?.logout?.()
      } catch {}
      try { location.reload() } catch {}
    } catch {}
  }
  function updatePermStatus() {
    try {
      const p = typeof Notification !== 'undefined' ? Notification.permission : undefined
      setPermWeb(p || null)
    } catch {
      setPermWeb(null)
    }
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      const p = OneSignal?.Notifications?.permission
      setPermOS(p || null)
    } catch {
      setPermOS(null)
    }
  }
  async function refreshOneSignalInfo() {
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      let ext: any = null
      let pid: any = null
      try { ext = OneSignal?.User?.externalId } catch {}
      if (!ext) { try { ext = await OneSignal?.getExternalUserId?.() } catch {} }
      setOsExternalId(ext ? String(ext) : null)
      try { pid = (OneSignal as any)?.User?.pushSubscriptionId } catch {}
      if (!pid) { try { pid = await OneSignal?.getSubscriptionId?.() } catch {} }
      setOsPlayerId(pid ? String(pid) : null)
    } catch {}
    try { updatePermStatus() } catch {}
    try { await refreshSwInfo() } catch {}
    try {
      const res = await fetch('/.well-known/assetlinks.json', { method: 'GET', cache: 'no-store' })
      setAssetLinksStatus(res.ok ? 'ok' : `erro ${res.status}`)
    } catch (e: any) {
      setAssetLinksStatus(`falha ${e?.message || 'UNKNOWN'}`)
    }
  }
  async function copyDebug() {
    try {
      const pushSubIdLive = (typeof window !== 'undefined' ? (window as any).OneSignal?.User?.pushSubscriptionId : null) || null
      const data = {
        userId,
        permWeb,
        permOS,
        initErrorTop,
        swRegistered,
        swScope,
        osExternalId,
        osPlayerId,
        pushSubscriptionIdLive: pushSubIdLive,
        dbPlayerId: dbPlayerId || profileOnesignalId,
        lastPayloadSent,
      }
      const text = JSON.stringify(data, null, 2)
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setUiMsg('Dados de diagnóstico copiados')
      } else {
        alert(text)
      }
    } catch {}
  }
  function openSiteSettings() {
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
      const isAndroid = /android/.test(ua)
      const isFirefox = /firefox/.test(ua)
      const isChrome = /chrome/.test(ua) && !/edge|edg|opr/.test(ua)
      if (isFirefox) {
        setShowHelp(true)
        return
      }
      if (isChrome && isAndroid) {
        setShowHelp(true)
        return
      }
      setShowHelp(true)
    } catch {
      setShowHelp(true)
    }
  }
  async function refreshSwInfo() {
    try {
      if (!('serviceWorker' in navigator)) { setSwRegistered(false); setSwScope(null); return }
      const regs = await navigator.serviceWorker.getRegistrations()
      let found = false
      let scope: string | null = null
      for (const r of regs) {
        const s1 = (r.active && (r.active as any).scriptURL) || ''
        const s2 = (r.installing && (r.installing as any).scriptURL) || ''
        const s3 = (r.waiting && (r.waiting as any).scriptURL) || ''
        const has = [s1, s2, s3].some((u) => typeof u === 'string' && /OneSignalSDKWorker\.js/i.test(u))
        if (has) { found = true; scope = r.scope; break }
      }
      setSwRegistered(found)
      setSwScope(scope)
    } catch {
      setSwRegistered(false)
      setSwScope(null)
    }
  }
  async function checkWorkerReachability() {
    try {
      const res = await fetch('/OneSignalSDKWorker.js', { method: 'GET' })
      setSwWorkerReachable(res.ok ? 'ok' : `erro ${res.status}`)
    } catch (e: any) {
      setSwWorkerReachable(`falha ${e?.message || 'UNKNOWN'}`)
    }
  }
  async function manualRegisterOneSignalSW() {
    try {
      setSwManualRegMsg(null)
      if (!('serviceWorker' in navigator)) { setSwManualRegMsg('SW não suportado'); return }
      await navigator.serviceWorker.register('/OneSignalSDKWorker.js')
      setSwManualRegMsg('Service Worker registrado manualmente')
      await refreshSwInfo()
    } catch (e: any) {
      setSwManualRegMsg(`Falha ao registrar SW: ${e?.message || 'UNKNOWN'}`)
    }
  }
  async function forceOptReset() {
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      if (!OneSignal) return
      await OneSignal?.User?.pushSubscription?.optOut?.()
      await OneSignal?.User?.pushSubscription?.optIn?.()
      try {
        const pid = (OneSignal as any)?.User?.pushSubscriptionId
        if (pid) {
          setOsPlayerId(String(pid))
          await saveSubscriptionIdToProfile(String(pid))
        }
      } catch {}
    } catch {}
  }
  async function clearAndReenable() {
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      if (OneSignal?.User?.pushSubscription?.optOut) {
        await OneSignal.User.pushSubscription.optOut()
      }
    } catch {}
    try { window.location.reload() } catch {}
  }
  async function resetFactory() {
    try {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) { try { await reg.unregister() } catch {} }
      } catch {}
      try { window.localStorage.clear() } catch {}
      try { window.sessionStorage.clear() } catch {}
      try { alert('Memória limpa! Reinicie o navegador e tente de novo.') } catch {}
      try { window.location.reload() } catch {}
    } catch {}
  }

  function addKeywordFromInput() {
    const parts = keywordsInput.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length === 0) return
    const set = new Set([...keywords, ...parts].map((s) => s.toLowerCase()))
    setKeywords(Array.from(set))
    setKeywordsInput('')
  }
  function removeKeyword(k: string) {
    setKeywords(keywords.filter((x) => x !== k))
  }
  function toggleUf(uf: string) {
    setUfs((prev) => prev.includes(uf) ? prev.filter((x) => x !== uf) : [...prev, uf])
  }
  

  async function savePrefs() {
    setError(null)
    if (!supabase || !userId) return
    const payload = {
      user_id: userId,
      keywords,
      ufs,
      valor_minimo: minValue ? Number(minValue) : 0,
      ativo: ativo,
      push_notificacao: pushOn,
    } as any
    // Tabela user_alerts não está disponível neste projeto; persistir localmente e garantir palavras-chave ativas em search_alerts
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(`user_alerts:${userId}`, JSON.stringify(payload)) } catch {}
    }
    try {
      const existing = await supabase.from('search_alerts').select('keyword').eq('user_id', userId).eq('active', true)
      const have = new Set<string>((existing.data || []).map((r: any) => String(r.keyword || '').trim().toLowerCase()).filter(Boolean))
      const toAdd = (keywords || []).map((k) => String(k || '').trim()).filter(Boolean).filter((k) => !have.has(k.toLowerCase()))
      if (toAdd.length) {
        const rows = toAdd.map((k) => ({ user_id: userId, keyword: k, active: true }))
        try { await supabase.from('search_alerts').insert(rows) } catch {}
      }
    } catch {}
    alert('Preferências salvas')
    try { window.location.reload() } catch {}
  }

  const canInteract = !!userId
  const subscribed = !!osPlayerId || permOS === 'granted' || permWeb === 'granted'
  const [clickCount, setClickCount] = useState(0)
  const clickTimerRef = useRef<any>(null)
  function onHiddenPinClick() {
    const next = clickCount + 1
    setClickCount(next)
    if (clickTimerRef.current) { try { clearTimeout(clickTimerRef.current) } catch {} }
    clickTimerRef.current = setTimeout(() => { try { setClickCount(0) } catch {} }, 2000)
    if (next >= 6) {
      setShowDebug(true)
      setClickCount(0)
      try { clearTimeout(clickTimerRef.current) } catch {}
    }
  }

  async function ensureOneSignalReady(): Promise<any> {
    const appId = (process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || (typeof window !== 'undefined' ? (window as any).ONESIGNAL_APP_ID : '') || '') as string
    const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
    if (!OneSignal) return null
    try {
      const hasCore = !!(OneSignal && OneSignal.User && OneSignal.Notifications)
      if (hasCore) return OneSignal
    } catch {}
    if (OneSignal && typeof OneSignal.init === 'function' && appId) {
      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
        })
      } catch {}
    }
    return (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
  }

  async function resyncNotifications() {
    try {
      setError(null)
      setUiMsg(null)
      try {
        const host = typeof location !== 'undefined' ? location.hostname.toLowerCase() : ''
        if (host === 'licitmasa.com.br') {
          try {
            const url = new URL(location.href)
            url.hostname = 'www.licitmasa.com.br'
            url.protocol = 'https:'
            location.href = url.toString()
          } catch {}
          setError('Acesse o site com www para sincronizar alertas')
          return
        }
      } catch {}
      let OneSignal: any = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      if (!OneSignal) { setError('OneSignal não carregado'); return }
      try {
        OneSignal = await ensureOneSignalReady()
      } catch {}
      if (!OneSignal) { setError('OneSignal indisponível'); return }
      let ext: string | null = null
      try {
        const ud = await supabase?.auth.getUser()
        ext = String(ud?.data?.user?.email || ud?.data?.user?.id || '')
      } catch {}
      if (ext) {
        try { OneSignal.login?.(ext) } catch {}
        
        try { setOsExternalId(ext) } catch {}
      }
      try { await OneSignal?.Notifications?.requestPermission?.() } catch {}
      let pid: string | null = null
      try { pid = (OneSignal as any)?.User?.pushSubscriptionId || null } catch {}
      if (!pid) { try { pid = await OneSignal?.getSubscriptionId?.() } catch {} }
      if (!pid) {
        try { await OneSignal?.User?.pushSubscription?.optIn?.() } catch {}
        try { pid = (OneSignal as any)?.User?.pushSubscriptionId || null } catch {}
        if (!pid) { try { pid = await OneSignal?.getSubscriptionId?.() } catch {} }
      }
      if (pid) {
        try { setOsPlayerId(String(pid)) } catch {}
        let savedOk = false
        try { await saveSubscriptionIdToProfile(String(pid)); savedOk = true } catch {}
        try {
          const { data: prof } = await supabase!.from('profiles').select('subscription_id').eq('id', userId!).maybeSingle()
          const subNow = String((prof as any)?.subscription_id || '')
          if (!subNow) { savedOk = false }
        } catch {}
        try {
          const sess = await supabase!.auth.getSession()
          const jwt = String(sess?.data?.session?.access_token || '')
          if (jwt) {
            const r = await fetch('/api/profile/sync-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
              body: JSON.stringify({ subscriptionId: String(pid) })
            })
            if (!r.ok) {
              const txt = await r.text().catch(() => '')
              setError(`Falha ao salvar no servidor (${r.status}): ${txt || '—'}`)
              try { alert(`Falha ao salvar no servidor (${r.status}): ${txt || '—'}`) } catch {}
            } else {
              savedOk = true
            }
          }
        } catch {}
        if (!savedOk) {
          try {
            await fetch('/api/admin/sync-onesignal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
              body: JSON.stringify({ userId, email: ext || undefined, subscriptionId: String(pid) })
            })
          } catch {}
        }
        try { 
          await refreshOneSignalInfo()
          const { data: prof3 } = await supabase!.from('profiles').select('subscription_id').eq('id', userId!).maybeSingle()
          const subNow2 = String((prof3 as any)?.subscription_id || '')
          if (!subNow2) setError('subscription_id não foi preenchido no servidor')
        } catch {}
        setUiMsg('Alertas sincronizados com sucesso!')
      } else {
        setError('Não foi possível obter o ID de inscrição do OneSignal')
      }
    } catch (e: any) {
      setError(String(e?.message || e))
    }
  }

  async function deactivateAlerts() {
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      try { await OneSignal?.User?.pushSubscription?.optOut?.() } catch {}
      try { setPushOn(false) } catch {}
      try { setUiMsg('Alertas desativados') } catch {}
      try { await refreshOneSignalInfo() } catch {}
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-blue-900">Meus Alertas</h1>
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-200">
                  <Info className="mr-1 h-4 w-4 text-blue-700" />
                  Como funcionam os alertas?
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-700" />
                    Sobre os nossos Alertas
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    Sobre os nossos Alertas: Para sua comodidade e para não interromper seu trabalho, nossas notificações são enviadas diretamente para a sua Central de Notificações. Você ouvirá o sinal sonoro e poderá consultar os detalhes deslizando a barra de status do seu celular para baixo.
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Button onClick={() => router.push('/')} className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-200">
              Voltar
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-900">Preferências de Busca Diária</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-700">Carregando...</div>
            ) : (
              <div className="space-y-6">
                {uiMsg && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{uiMsg}</div>}
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">🔔 Você receberá resumos automáticos às 07:00 horas e às 16:00 horas.</div>
                <div className={subscribed ? "rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800" : "rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800"}>
                  {subscribed ? "✅ Alertas Ativados: Você receberá avisos sobre novas publicações." : "🔔 Alertas Desativados: Clique no botão abaixo para ativar."}
                </div>
                {!subscribed && error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
                ) : null}
                <div className="flex items-center">
                  {subscribed ? (
                    <Button onClick={deactivateAlerts} className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                      Desativar Alertas
                    </Button>
                  ) : (
                    <Button onClick={() => { activateOneSignal(); updatePermStatus() }} className="bg-blue-800 text-white hover:bg-blue-700">
                      Ativar Alertas de Publicações
                    </Button>
                  )}
                </div>
                
                {showHelp && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    <div className="font-medium mb-2">Como permitir notificações</div>
                    <div className="space-y-2">
                      <div>Android Chrome: toque no cadeado ao lado da barra de endereço → Notificações → Permitir.</div>
                      <div>Desktop Chrome/Firefox: clique no cadeado ao lado do endereço → Notificações → Permitir.</div>
                      <div>iOS Safari: iOS 16.4+, permita notificações nas Configurações e considere instalar o site como App.</div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button onClick={() => { setShowHelp(false); activateOneSignal(); updatePermStatus() }} className="bg-blue-800 text-white hover:bg-blue-700">Tentar novamente</Button>
                      <Button onClick={() => setShowHelp(false)} className="bg-gray-100 text-gray-800 hover:bg-gray-200">Fechar</Button>
                    </div>
                  </div>
                )}
                <div className="grid gap-3">
                  <label className="text-xs font-medium text-slate-500 uppercase">Palavras-chave</label>
                  <div className="flex items-end gap-2">
                    <Input
                      placeholder="Digite e pressione Enter ou vírgula"
                      value={keywordsInput}
                      onChange={(e) => setKeywordsInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addKeywordFromInput() }}
                      disabled={!canInteract}
                    />
                    <Button onClick={addKeywordFromInput} className="bg-blue-800 text-white hover:bg-blue-700" disabled={!canInteract}>Adicionar</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((k) => (
                      <button key={k} onClick={() => canInteract && removeKeyword(k)} className={"inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-blue-900 " + (canInteract ? "bg-blue-50 hover:bg-blue-100" : "bg-gray-100")}>
                        <Badge className="bg-blue-100 text-blue-800">{k}</Badge>
                        remover
                      </button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <Button
                      onClick={resyncNotifications}
                      title="Use este botão se você não estiver recebendo avisos de novas licitações. Isso sincroniza as notificações com este dispositivo e não altera seu plano de pagamento."
                      className="bg-amber-600 text-white hover:bg-amber-700 text-xs"
                    >
                      🔔 Reativar Alertas neste Aparelho
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3">
                  <label className="text-xs font-medium text-slate-500 uppercase">Estados (UF)</label>
                  <div className="grid grid-cols-6 gap-2">
                    {UFS.map((uf) => {
                      const on = ufs.includes(uf)
                      return (
                        <button
                          key={uf}
                          onClick={() => canInteract && toggleUf(uf)}
                          className={"inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs " + (on ? "bg-blue-800 text-white border-blue-700" : "bg-white text-gray-800") + (canInteract ? "" : " opacity-60")}
                        >
                          {uf}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase">Valor mínimo (R$)</label>
                    <Input
                      placeholder="Ex: 10000"
                      value={minValue}
                      onChange={(e) => setMinValue(e.target.value.replace(/[^\d.,]/g, ''))}
                      disabled={!canInteract}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase">Ativar alerta diário</label>
                    <Button onClick={() => canInteract && setAtivo((v) => !v)} className={"border " + (ativo ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-100 text-gray-800 hover:bg-gray-200")} disabled={!canInteract}>
                      {ativo ? "Ativado" : "Desativado"}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase">Receber Push</label>
                    <Button onClick={() => canInteract && setPushOn((v) => !v)} className={"border " + (pushOn ? "bg-blue-800 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-800 hover:bg-gray-200")} disabled={!canInteract}>
                      {pushOn ? "Ativado" : "Desativado"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <div className="flex gap-2">
                    <Button onClick={savePrefs} disabled={!canInteract} className="bg-blue-800 text-white hover:bg-blue-700">Salvar Configurações</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-900">Ajuda / FAQ</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion
                single
                items={[
                  {
                    id: 'faq-notificacoes',
                    title: <span>Como ativar som e notificações</span>,
                    content: (
                      <div className="space-y-3 text-sm text-gray-800">
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-900">
                          Após configurar os alertas, se não estiver recebendo notificações, abra as permissões do site e habilite notificações e som.
                        </div>
                        <div>
                          <div className="font-medium">Android (Chrome)</div>
                          <ul className="list-disc pl-4">
                            <li>Abra o site e toque no cadeado ao lado do endereço.</li>
                            <li>Em “Permissões”, defina “Notificações” como “Permitir”.</li>
                            <li>Verifique em Configurações do Android → Apps → Chrome → Notificações se o som está ativado.</li>
                            <li>Ative também o modo não perturbador para permitir alertas sonoros quando necessário.</li>
                          </ul>
                        </div>
                        <div>
                          <div className="font-medium">iOS (Safari)</div>
                          <ul className="list-disc pl-4">
                            <li>iOS 16.4 ou superior: abra Ajustes → Safari → “Permitir Notificações”.</li>
                            <li>No site, toque no ícone de “aA” na barra → Notificações → “Permitir”.</li>
                            <li>Em Ajustes → Notificações → Safari, ative “Sons” e “Alertas”.</li>
                          </ul>
                        </div>
                        <div>
                          <div className="font-medium">Desktop (Chrome/Firefox)</div>
                          <ul className="list-disc pl-4">
                            <li>Clique no cadeado ao lado do endereço e marque “Notificações: Permitir”.</li>
                            <li>Verifique em Sistema → Som → Preferências de app se o navegador tem som habilitado.</li>
                            <li>Confirme que não há bloqueio por antivírus/Firewall para notificações do navegador.</li>
                          </ul>
                        </div>
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          Dica: ao receber, você ouvirá o sinal e poderá ver detalhes na Central de Notificações deslizando a barra de status para baixo.
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'faq-nao-recebendo',
                    title: <span>Não estou recebendo notificações</span>,
                    content: (
                      <div className="space-y-3 text-sm text-gray-800">
                        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-yellow-900">
                          Faça este checklist rápido:
                        </div>
                        <ul className="list-disc pl-4">
                          <li>Permissões do site: habilite “Notificações” como “Permitir”.</li>
                          <li>Som do dispositivo: verifique volume, modo silencioso e “Não Perturbe”.</li>
                          <li>Economia de bateria: em Android, permita atividade em segundo plano para o navegador.</li>
                          <li>Conexão: garanta internet estável (Wi‑Fi ou dados móveis).</li>
                          <li>Abra a Central de Notificações deslizando a barra de status para baixo.</li>
                        </ul>
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          Se ainda assim não aparecer, toque em “Ativar Alertas de Publicação” na página e confirme as permissões do navegador.
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'faq-confirmar-ativo',
                    title: <span>Como confirmar que os alertas estão ativos</span>,
                    content: (
                      <div className="space-y-3 text-sm text-gray-800">
                        <ul className="list-disc pl-4">
                          <li>Veja a mensagem “Notificações permitidas” ao ativar.</li>
                          <li>Deixe “Receber Push” marcado como “Ativado” nas preferências.</li>
                          <li>Teste o recebimento aguardando os horários diários (07:00 e 16:00).</li>
                          <li>Verifique se o site está acessado em HTTPS ou salvo como atalho/app no celular.</li>
                        </ul>
                      </div>
                    ),
                  },
                  {
                    id: 'faq-alertas-whatsapp',
                    title: <span>Alertas x WhatsApp</span>,
                    content: (
                      <div className="space-y-3 text-sm text-gray-800">
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-900">
                          Os alertas são notificações nativas do seu dispositivo, entregues nos horários configurados. O WhatsApp é usado para compartilhar publicações manualmente com sua equipe ou clientes.
                        </div>
                        <ul className="list-disc pl-4">
                          <li>Alertas: chegam na Central de Notificações com som e resumo.</li>
                          <li>WhatsApp: opção de compartilhamento a partir das páginas de resultados.</li>
                        </ul>
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-900">Suporte Técnico / Diagnóstico</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion
                items={[
                  {
                    id: 'diag-acoes',
                    title: <span>Ações de teste</span>,
                    content: (
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={handleTestAndDiagnose} disabled={testLoading || diagRunning} className="bg-blue-600 text-white hover:bg-blue-700 text-xs">
                            {(testLoading || diagRunning) ? '...' : 'Enviar Teste / Diagnóstico'}
                          </Button>
                          <span
                            aria-hidden
                            onClick={onHiddenPinClick}
                            className="ml-1 inline-block h-3 w-3 rounded-full bg-white"
                            title=""
                          />
                        </div>
                        <div className="mt-3">
                          {showDebug && diagItems && diagItems.length > 0 && (
                            <ul className="space-y-1 text-sm">
                              {diagItems.map((it) => (
                                <li key={it.id} className="flex items-start gap-2">
                                  <span className="mt-[2px]">{it.ok ? '✅' : '❌'}</span>
                                  <span>
                                    <span className="font-medium">{it.label}</span>
                                    {it.detail ? <span className="text-gray-600"> — {it.detail}</span> : null}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
