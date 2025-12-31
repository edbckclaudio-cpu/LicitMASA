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
      try {
        const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
        if (OneSignal) {
          await OneSignal?.login?.(user.id)
          await OneSignal?.setExternalUserId?.(user.id)
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
      const { data, error: uaErr } = await supabase.from('user_alerts').select('id,keywords,ufs,valor_minimo,push_notificacao,ativo').eq('user_id', user.id).limit(1).maybeSingle()
      if (data) {
        setSavedId(String(data.id))
        setKeywords(Array.isArray(data.keywords) ? data.keywords.filter((x: any) => typeof x === 'string') : [])
        setUfs(Array.isArray(data.ufs) ? data.ufs.filter((x: any) => typeof x === 'string') : [])
        setMinValue(data.valor_minimo ? String(data.valor_minimo) : '')
        setAtivo(Boolean(data.ativo))
        setPushOn(Boolean(data.push_notificacao))
        try {
          if (supabase) {
            const { data: tok } = await supabase.from('user_alerts').select('fcm_token').eq('user_id', user.id).limit(1).maybeSingle()
            const t = String((tok as any)?.fcm_token || '')
            if (t) setOsPlayerId(t)
          }
        } catch {}
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
      const run = async () => {
        if (supabase && userId && osPlayerId) {
          try {
            await supabase.from('profiles').update({ onesignal_id: String(osPlayerId) }).eq('id', userId)
          } catch {}
        }
      }
      run()
    } catch {}
  }, [userId, osPlayerId])
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
      try { ext = OneSignal?.User?.externalId } catch {}
      if (!ext) { try { ext = await OneSignal?.getExternalUserId?.() } catch {} }
      setOsExternalId(ext ? String(ext) : null)
      try { pid = OneSignal?.User?.PushSubscription?.id } catch {}
      if (!pid) { try { pid = await OneSignal?.getSubscriptionId?.() } catch {} }
      setOsPlayerId(pid ? String(pid) : null)
      if (!pid && userId) {
        try {
          if (supabase) {
            const { data: tok } = await supabase.from('user_alerts').select('fcm_token').eq('user_id', userId).limit(1).maybeSingle()
            const t = String((tok as any)?.fcm_token || '')
            if (t) setOsPlayerId(t || null)
          }
        } catch {}
      }
    } catch {}
  }
  loadOneSignalInfo()
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
      let playerIdToUse = osPlayerId || null
      let externalIdToUse = osExternalId || null
      if (!externalIdToUse) {
        try {
          externalIdToUse = (typeof window !== 'undefined' ? (window as any).OneSignal?.User?.externalId : null) || null
        } catch {}
      }
      if (!playerIdToUse) {
        try {
          if (supabase) {
            const { data: prof } = await supabase.from('profiles').select('onesignal_id').eq('id', userId).limit(1).maybeSingle()
            const p = String((prof as any)?.onesignal_id || '')
            if (p) playerIdToUse = p
          }
        } catch {}
      }
      if (!playerIdToUse) {
        try {
          if (supabase) {
            const { data: tok } = await supabase.from('user_alerts').select('fcm_token').eq('user_id', userId).limit(1).maybeSingle()
            const t = String((tok as any)?.fcm_token || '')
            if (t) playerIdToUse = t
          }
        } catch {}
      }
      const res = await fetch('/api/notifications/onesignal-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: externalIdToUse || '',
          userId,
          playerId: playerIdToUse,
          title: 'Teste de Alerta',
          body: 'Notificação de teste via OneSignal',
        }),
      })
      try {
        const raw = await res.clone().text()
        let data: any = null
        try { data = JSON.parse(raw) } catch {}
        const sentExternal = externalIdToUse || userId
        const recipients = typeof data?.recipients === 'number' ? data.recipients : null
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
        } catch {
          setUiMsg('Falha ao enviar notificação')
        }
      }
    } catch {
      setUiMsg('Falha ao enviar notificação')
    } finally {
      setTestLoading(false)
    }
  }
  async function saveSubscriptionIdToProfile(id: string) {
    try { if (supabase && userId && id) await supabase.from('profiles').update({ onesignal_id: String(id) }).eq('id', userId) } catch {}
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
                      </div>
                    </div>
                  </div>
                )}
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
