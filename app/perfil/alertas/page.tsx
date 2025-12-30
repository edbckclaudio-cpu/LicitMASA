'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
declare const OneSignal: any

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

export default function AlertasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPremium, setIsPremium] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
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
  const [showHelp, setShowHelp] = useState(false)
  const isGranted = useMemo(() => (permOS === 'granted' || permWeb === 'granted'), [permOS, permWeb])
  const [osExternalId, setOsExternalId] = useState<string | null>(null)
  const [osPlayerId, setOsPlayerId] = useState<string | null>(null)
  const [initErrorTop, setInitErrorTop] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      setLoading(true)
      setError(null)
      if (!supabase) { setError('Configure o Supabase'); setLoading(false); return }
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data: prof, error: profErr } = await supabase.from('profiles').select('is_premium, plan').eq('id', user.id).single()
      const allow = String(process.env.NEXT_PUBLIC_PREMIUM_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
      const email = String(user.email || '').toLowerCase()
      const premium = Boolean(prof?.is_premium) || String(prof?.plan || '').toLowerCase() === 'premium' || allow.includes(email)
      setIsPremium(premium)
      const { data, error: uaErr } = await supabase.from('user_alerts').select('id,keywords,ufs,valor_minimo,push_notificacao,ativo').eq('user_id', user.id).limit(1).maybeSingle()
      if (data) {
        setSavedId(String(data.id))
        setKeywords(Array.isArray(data.keywords) ? data.keywords.filter((x: any) => typeof x === 'string') : [])
        setUfs(Array.isArray(data.ufs) ? data.ufs.filter((x: any) => typeof x === 'string') : [])
        setMinValue(data.valor_minimo ? String(data.valor_minimo) : '')
        setAtivo(Boolean(data.ativo))
        setPushOn(Boolean(data.push_notificacao))
      } else if (typeof window !== 'undefined') {
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
    }
    init()
  }, [])
  useEffect(() => {
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
    async function loadOneSignalInfo() {
      try {
        const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
        if (!OneSignal) return
        let ext: any = null
        let pid: any = null
        try { ext = await OneSignal?.User?.getExternalId?.() } catch {}
        if (!ext) { try { ext = await OneSignal?.getExternalUserId?.() } catch {} }
        setOsExternalId(ext ? String(ext) : null)
        try { pid = await OneSignal?.getUserId?.() } catch {}
        if (!pid) { try { pid = await OneSignal?.User?.getUserId?.() } catch {} }
        if (!pid) { try { pid = OneSignal?.User?.pushSubscription?.id } catch {} }
        if (!pid) { try { pid = await OneSignal?.getSubscriptionId?.() } catch {} }
        setOsPlayerId(pid ? String(pid) : null)
      } catch {}
    }
    loadOneSignalInfo()
  }, [])
  useEffect(() => {
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      OneSignal?.Debug?.setLogLevel?.('verbose')
    } catch {}
    try {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null
      if (nav?.serviceWorker?.getRegistrations) {
        nav.serviceWorker.getRegistrations().then((regs: any) => {
          try { console.log('ServiceWorker registrations:', regs) } catch {}
        }).catch((e: any) => {
          try { console.error('ServiceWorker check error:', e) } catch {}
        })
      }
    } catch {}
  }, [])

  async function sendTestNotification() {
    try {
      setUiMsg(null)
      setError(null)
      setTestLoading(true)
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
      const res = await fetch('/api/notifications/onesignal-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: 'Teste de Alerta',
          body: 'Notificação de teste via OneSignal',
        }),
      })
      try { const j = await res.clone().json(); console.log('OneSignal test response', j) } catch {}
      if (res.ok) {
        setUiMsg('Notificação enviada')
      } else {
        setUiMsg('Falha ao enviar notificação')
      }
    } catch {
      setUiMsg('Falha ao enviar notificação')
    } finally {
      setTestLoading(false)
    }
  }
  async function resetTechnical() {
    try {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null
      if (nav?.serviceWorker?.getRegistrations) {
        const regs = await nav.serviceWorker.getRegistrations().catch(() => [])
        for (const r of regs) {
          try { await r.unregister() } catch {}
        }
      }
    } catch {}
    try { window.localStorage.removeItem('onesignal-notification-prompt-counts') } catch {}
    try { (window as any).location?.reload?.(true) } catch { try { window.location.reload() } catch {} }
  }
  async function repairLink() {
    try {
      setUiMsg(null)
      setError(null)
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      if (!OneSignal) { setError('OneSignal não carregado'); return }
      if (!userId) { setError('Entre para reparar vínculo'); return }
      try { OneSignal?.Debug?.setLogLevel?.('verbose') } catch {}
      try {
        const nav: any = typeof navigator !== 'undefined' ? navigator : null
        if (nav?.serviceWorker?.getRegistrations) {
          const regs = await nav.serviceWorker.getRegistrations().catch(() => [])
          try { console.log('ServiceWorker registrations:', regs) } catch {}
        }
      } catch {}
      try { console.log('Tentando vincular o ID:', userId) } catch {}
      try { await OneSignal?.User?.PushSubscription?.optIn?.() } catch {}
      try {
        const perm = typeof Notification !== 'undefined' ? Notification.permission : 'unknown'
        const pid = (() => {
          try { return OneSignal?.User?.PushSubscription?.id || null } catch { return null }
        })()
        if (pid) alert('ID Gerado: ' + String(pid))
      } catch {}
      let beforeExt: any = null
      try { beforeExt = await OneSignal?.User?.getExternalId?.() } catch {}
      if (!beforeExt) { try { beforeExt = await OneSignal?.getExternalUserId?.() } catch {} }
      try { console.log('External ID antes do login:', beforeExt) } catch {}
      try { await OneSignal?.login?.(userId) } catch (e: any) { try { console.error('OneSignal.login error:', e) } catch {} }
      try { await OneSignal?.User?.addTag?.('user_id', userId) } catch (e: any) { try { console.error('OneSignal.addTag error:', e) } catch {} }
      let afterExt: any = null
      let afterPid: any = null
      try { afterExt = await OneSignal?.User?.getExternalId?.() } catch {}
      if (!afterExt) { try { afterExt = await OneSignal?.getExternalUserId?.() } catch {} }
      try { console.log('External ID após login:', afterExt) } catch {}
      try { afterPid = await OneSignal?.getUserId?.() } catch {}
      if (!afterPid) { try { afterPid = await OneSignal?.User?.getUserId?.() } catch {} }
      if (!afterPid) { try { afterPid = OneSignal?.User?.pushSubscription?.id } catch {} }
      if (!afterPid) { try { afterPid = await OneSignal?.getSubscriptionId?.() } catch {} }
      setOsExternalId(afterExt ? String(afterExt) : null)
      setOsPlayerId(afterPid ? String(afterPid) : null)
      updatePermStatus()
      setUiMsg('Vínculo atualizado')
      try { setTimeout(() => { try { window.location.reload() } catch {} }, 2000) } catch {}
    } catch {
      setError('Falha ao reparar vínculo')
    }
  }
  async function activateOneSignal() {
    try {
      setUiMsg(null)
      setError(null)
      if (typeof window === 'undefined') { setError('OneSignal indisponível'); return }
      const OneSignal = (window as any).OneSignal
      if (!OneSignal) { setError('OneSignal não carregado'); return }
      let perm: string | undefined
      try { perm = OneSignal?.Notifications?.permission } catch {}
      if (perm === 'granted') {
        setUiMsg('Você já está recebendo alertas!')
        try {
          if (userId) {
            OneSignal.push(function() { OneSignal.setExternalUserId(userId) })
          }
        } catch {}
        return
      }
      try {
        await OneSignal?.Notifications?.requestPermission()
      } catch {}
      try { perm = OneSignal?.Notifications?.permission } catch {}
      if (perm === 'granted') {
        setUiMsg('Alertas ativados! ✅')
        try {
          if (userId) {
            OneSignal.push(function() { OneSignal.setExternalUserId(userId) })
          }
        } catch {}
      } else {
        setError('Permissão negada ou não concedida')
      }
    } catch {
      setError('Falha ao ativar notificações')
    }
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
  async function resetAndRequestPermission() {
    try {
      setUiMsg(null)
      setError(null)
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      if (!OneSignal) { setError('OneSignal não carregado'); return }
      try { OneSignal?.Debug?.setLogLevel?.('verbose') } catch {}
      try { await OneSignal?.Notifications?.requestPermission() } catch (e: any) { try { console.error('OneSignal requestPermission error:', e) } catch {} }
      updatePermStatus()
    } catch {
      setError('Falha ao solicitar permissão')
    }
  }
  async function forceNativePermission() {
    const permission = await window.Notification.requestPermission();
    alert('Resultado da permissão: ' + permission);
    if (permission === 'granted') {
      await OneSignal.Notifications.requestPermission();
      window.location.reload();
    }
  }
  async function forceGenerateIdNow() {
    try {
      await OneSignal.User.PushSubscription.optIn();
      const id = OneSignal.User.PushSubscription.id;
      alert('ID Gerado: ' + id);
    } catch (e: any) {
      alert('Erro ao gerar: ' + e.message);
    }
  }
  async function registerAndroidNow() {
    try {
      await OneSignal.User.PushSubscription.optIn();
      alert('Registro solicitado. Verifique se o ID aparece após alguns segundos.');
    } catch (e: any) {
      alert('Erro ao registrar: ' + e.message);
    }
  }
  function testSdkLoad() {
    try {
      const fn = typeof window !== 'undefined' ? (window as any).verificarOneSignal : null
      if (typeof fn === 'function') {
        fn()
      } else {
        alert('Função não definida')
      }
    } catch {
      alert('Falha ao executar teste')
    }
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
  async function syncDevice() {
    try {
      setUiMsg(null)
      setError(null)
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      if (!OneSignal) { setError('OneSignal não carregado'); return }
      if (!userId) { setError('Entre para sincronizar'); return }
      try { console.log('Tentando vincular ID:', userId) } catch {}
      try { await OneSignal?.login?.(userId) } catch {}
      try { await OneSignal?.User?.addTag?.('user_id', userId) } catch {}
      try { await OneSignal?.setExternalUserId?.(userId) } catch {}
      try {
        let ext: any = null
        let pid: any = null
        try { ext = await OneSignal?.User?.getExternalId?.() } catch {}
        if (!ext) { try { ext = await OneSignal?.getExternalUserId?.() } catch {} }
        setOsExternalId(ext ? String(ext) : null)
        try { pid = await OneSignal?.getUserId?.() } catch {}
        if (!pid) { try { pid = await OneSignal?.User?.getUserId?.() } catch {} }
        if (!pid) { try { pid = OneSignal?.User?.pushSubscription?.id } catch {} }
        if (!pid) { try { pid = await OneSignal?.getSubscriptionId?.() } catch {} }
        setOsPlayerId(pid ? String(pid) : null)
      } catch {}
      setUiMsg('Dispositivo sincronizado')
    } catch {
      setError('Falha ao sincronizar dispositivo')
    }
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
    const { data, error } = await supabase.from('user_alerts').upsert(payload, { onConflict: 'user_id' }).select('id').maybeSingle()
    if (error) {
      if (typeof window !== 'undefined') {
        try { window.localStorage.setItem(`user_alerts:${userId}`, JSON.stringify(payload)) } catch {}
        alert('Preferências salvas localmente')
        return
      }
      setError('Falha ao salvar preferências')
      return
    }
    if (data?.id) setSavedId(String(data.id))
    alert('Preferências salvas')
  }

  const canInteract = !!userId

  return (
    <div className="min-h-screen bg-gray-50">
      {initErrorTop && <div className="mx-auto max-w-5xl px-6 py-3"><div className="rounded-md border-2 border-red-300 bg-red-50 p-3 text-xl font-semibold text-red-800">{initErrorTop}</div></div>}
      <div className="px-6 py-2 text-xs text-gray-700">Debug ID: {String(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '')}</div>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-blue-900">Meus Alertas</h1>
          <div className="flex items-center gap-2">
            <Button onClick={sendTestNotification} disabled={testLoading} className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
              {testLoading ? '...' : 'Enviar Teste'}
            </Button>
            <Button onClick={() => router.push('/')} className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-xs font-medium text-gray-800 hover:bg-gray-200">
              Voltar
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6">
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-gray-800">
          <div className="font-medium mb-2">Painel de Diagnóstico</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="rounded-md border px-2 py-1 text-xs">User ID (Supabase): {userId || '—'}</div>
            <div className="rounded-md border px-2 py-1 text-xs">External ID (OneSignal): {osExternalId || '—'}</div>
            <div className="rounded-md border px-2 py-1 text-xs">Subscription ID: {osPlayerId || '—'}</div>
          </div>
          <div className="mt-2">
            <Button onClick={repairLink} className="bg-blue-800 text-white hover:bg-blue-700">Reparar Vínculo</Button>
          </div>
        </div>
      </div>
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
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
                )}
                {!isGranted && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div>Ative as notificações no navegador</div>
                        <div className="text-xs text-red-700">Status Web: {String(permWeb || 'indisponível')}</div>
                        <div className="text-xs text-red-700">Status OneSignal: {String(permOS || 'indisponível')}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => { activateOneSignal(); updatePermStatus() }} className="bg-red-600 text-white hover:bg-red-700">
                          Ativar Alertas de Licitação
                        </Button>
                        <Button onClick={openSiteSettings} className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                          Abrir configurações do site
                        </Button>
                        <Button onClick={resetAndRequestPermission} className="bg-gray-200 text-gray-900 hover:bg-gray-300">
                          Resetar e Pedir Permissão Novamente
                        </Button>
                        <Button onClick={forceNativePermission} className="bg-orange-600 text-white hover:bg-orange-700">
                          [FORÇAR DIÁLOGO DE PERMISSÃO]
                        </Button>
                        <Button onClick={forceGenerateIdNow} className="bg-indigo-700 text-white hover:bg-indigo-800">
                          [FORÇAR GERAÇÃO DE ID AGORA]
                        </Button>
                        <Button onClick={registerAndroidNow} className="bg-green-700 text-white hover:bg-green-800">
                          [REGISTRAR MEU ANDROID AGORA]
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {isGranted && (
                  <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <div>Notificações permitidas</div>
                        <div className="text-xs text-green-700">Status Web: {String(permWeb || 'indisponível')}</div>
                        <div className="text-xs text-green-700">Status OneSignal: {String(permOS || 'indisponível')}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button onClick={() => { activateOneSignal(); updatePermStatus() }} className="bg-green-600 text-white hover:bg-green-700">
                          Já está ativo
                        </Button>
                        <Button onClick={resetAndRequestPermission} className="bg-gray-200 text-gray-900 hover:bg-gray-300">
                          Resetar e Pedir Permissão Novamente
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-gray-800">
                  <div className="font-medium mb-2">Diagnóstico OneSignal</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="rounded-md border px-2 py-1 text-xs">Meu ID no Banco: {userId || '—'}</div>
                    <div className="rounded-md border px-2 py-1 text-xs">Meu ID no OneSignal: {osPlayerId || '—'}</div>
                    <div className="rounded-md border px-2 py-1 text-xs">Vínculo: {osExternalId || '—'}</div>
                  </div>
                  <div className="mt-2">
                    <Button onClick={syncDevice} className="bg-blue-800 text-white hover:bg-blue-700">Vincular meu Aparelho</Button>
                    <Button onClick={testSdkLoad} className="ml-2 bg-gray-200 text-gray-900 hover:bg-gray-300">TESTAR CARREGAMENTO DO SDK</Button>
                    <Button onClick={resetTechnical} className="ml-2 bg-red-600 text-white hover:bg-red-700">Limpar Registros Técnicos (Reset)</Button>
                  </div>
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
      </main>
    </div>
  )
}
