'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { requestAndSaveToken } from '@/lib/firebase'

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
  const [whats, setWhats] = useState('')
  const [pushOn, setPushOn] = useState(true)
  const [waOn, setWaOn] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

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
      const { data, error: uaErr } = await supabase.from('user_alerts').select('id,keywords,ufs,valor_minimo,whatsapp_notificacao,whatsapp_numero,push_notificacao,ativo').eq('user_id', user.id).limit(1).maybeSingle()
      if (data) {
        setSavedId(String(data.id))
        setKeywords(Array.isArray(data.keywords) ? data.keywords.filter((x: any) => typeof x === 'string') : [])
        setUfs(Array.isArray(data.ufs) ? data.ufs.filter((x: any) => typeof x === 'string') : [])
        setMinValue(data.valor_minimo ? String(data.valor_minimo) : '')
        setAtivo(Boolean(data.ativo))
        setWhats(String(data.whatsapp_numero || ''))
        setPushOn(Boolean(data.push_notificacao))
        setWaOn(Boolean(data.whatsapp_notificacao))
      } else if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(`user_alerts:${user.id}`) || ''
          const j = raw ? JSON.parse(raw) : null
          if (j && typeof j === 'object') {
            setKeywords(Array.isArray(j.keywords) ? j.keywords.filter((x: any) => typeof x === 'string') : [])
            setUfs(Array.isArray(j.ufs) ? j.ufs.filter((x: any) => typeof x === 'string') : [])
            setMinValue(j.valor_minimo ? String(j.valor_minimo) : '')
            setAtivo(Boolean(j.ativo))
            setWhats(String(j.whatsapp_numero || ''))
            setPushOn(Boolean(j.push_notificacao))
            setWaOn(Boolean(j.whatsapp_notificacao))
          }
        } catch {}
      }
      setLoading(false)
    }
    init()
  }, [])
  useEffect(() => {
    async function ensurePushSetup() {
      if (!userId || !pushOn) return
      await requestAndSaveToken()
    }
    ensurePushSetup()
  }, [userId, pushOn])

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
  function formatPhoneBR(v: string): string {
    const d = v.replace(/\D/g, '')
    if (d.length <= 2) return d
    if (d.startsWith('55')) {
      const n = d.slice(2)
      const p1 = n.slice(0, 2)
      const p2 = n.slice(2, 7)
      const p3 = n.slice(7, 11)
      return `+55 ${p1} ${p2}${p3 ? '-' + p3 : ''}`.trim()
    } else {
      const p1 = d.slice(0, 2)
      const p2 = d.slice(2, 7)
      const p3 = d.slice(7, 11)
      return `+55 ${p1} ${p2}${p3 ? '-' + p3 : ''}`.trim()
    }
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
      whatsapp_notificacao: waOn,
      whatsapp_numero: whats || null,
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
          <Button onClick={() => router.push('/')} className="bg-gray-100 text-gray-800 hover:bg-gray-200">Voltar</Button>
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
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">🔔 Você receberá resumos automáticos às 07:00 horas e às 16:00 horas.</div>
                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    <label className="text-xs font-medium text-slate-500 uppercase">WhatsApp para alertas</label>
                    <Input
                      placeholder="Ex: +55 11 99999-9999"
                      value={whats}
                      onChange={(e) => setWhats(formatPhoneBR(e.target.value))}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase">Receber Push</label>
                    <Button onClick={() => canInteract && setPushOn((v) => !v)} className={"border " + (pushOn ? "bg-blue-800 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-800 hover:bg-gray-200")} disabled={!canInteract}>
                      {pushOn ? "Ativado" : "Desativado"}
                    </Button>
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-slate-500 uppercase">Receber via WhatsApp</label>
                    <Button onClick={() => canInteract && setWaOn((v) => !v)} className={"border " + (waOn ? "bg-blue-800 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-800 hover:bg-gray-200")} disabled={!canInteract}>
                      {waOn ? "Ativado" : "Desativado"}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-end">
                  <div className="flex gap-2">
                    <Button onClick={async () => {
                      if (!canInteract) return
                      const t = await requestAndSaveToken()
                      if (!t) { setError('Permissão negada ou indisponível'); return }
                      try {
                        if (typeof window !== 'undefined' && Notification.permission === 'granted') {
                          try { new Notification('LicitMASA', { body: 'Seu dispositivo está pronto para receber alertas às 07:00 e às 16:00.' }) } catch {}
                        }
                        await fetch('/api/notifications/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ token: t })
                        }).catch(() => {})
                        alert('Notificação de teste acionada')
                      } catch {
                        setError('Falha ao enviar notificação')
                      }
                    }} disabled={!canInteract} className="bg-green-600 text-white hover:bg-green-700">🔔 Testar Notificação Agora</Button>
                    <Button onClick={savePrefs} disabled={!((keywords.length > 0 || ufs.length > 0) && canInteract)} className="bg-blue-800 text-white hover:bg-blue-700">Salvar Configurações</Button>
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
