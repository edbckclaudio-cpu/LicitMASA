'use client'
import React from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { BottomNavigation } from '@/components/ui/bottom-navigation'
import { Accordion } from '@/components/ui/accordion'
import { BadgeCheck, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Calendar, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

export default function PreparacaoPage() {
  const modeloAtestado = `Declaramos, para os devidos fins, que a empresa ________, inscrita no CNPJ sob nº __________,
executou, com qualidade e dentro dos prazos estabelecidos, os serviços de ____________,
no período de __/__/____ a __/__/____, atendendo integralmente às especificações técnicas e
operacionais exigidas, sem registro de inconformidades. Este atestado é emitido para fins de
comprovação de capacidade técnica em processos licitatórios.`
  const [redirectInfo, setRedirectInfo] = React.useState(false as boolean)
  const [certs, setCerts] = React.useState<Array<{ id: string; certificate_name: string; expiry_date: string; notified: boolean }>>([])
  const [loadingCerts, setLoadingCerts] = React.useState(false)
  const [addOpen, setAddOpen] = React.useState(false)
  const [newName, setNewName] = React.useState<string>('CND Federal')
  const [newDate, setNewDate] = React.useState<string>('')
  const [uiMsg, setUiMsg] = React.useState<string>('')
  React.useEffect(() => {
    async function load() {
      if (!supabase) {
        setCerts([])
        setUiMsg('Configure o Supabase no .env')
        return
      }
      setLoadingCerts(true)
      try {
        const { data: userData } = await supabase.auth.getUser()
        const user = userData?.user
        if (!user) {
          setCerts([])
          setUiMsg('Entre para gerenciar vencimentos')
          return
        }
        const { data, error } = await supabase
          .from('user_certificates')
          .select('id,certificate_name,expiry_date,notified')
          .eq('user_id', user.id)
          .order('expiry_date', { ascending: true })
        if (!error) setCerts(data || [])
      } finally {
        setLoadingCerts(false)
      }
    }
    load()
  }, [])
  async function addCert() {
    if (!supabase) { setUiMsg('Configure o Supabase no .env'); return }
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) { setUiMsg('Entre para adicionar certidões'); return }
    if (!newDate) { setUiMsg('Informe a data de vencimento'); return }
    const { error } = await supabase.from('user_certificates').insert({
      user_id: user.id,
      certificate_name: newName,
      expiry_date: newDate,
      notified: false,
    } as any)
    if (!error) {
      const { data } = await supabase
        .from('user_certificates')
        .select('id,certificate_name,expiry_date,notified')
        .eq('user_id', user.id)
        .order('expiry_date', { ascending: true })
      setCerts(data || [])
      setAddOpen(false)
      setNewDate('')
      setUiMsg('')
    } else {
      setUiMsg('Falha ao salvar certidão')
    }
  }
  async function delCert(id: string) {
    if (!supabase) { setUiMsg('Configure o Supabase no .env'); return }
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) { setUiMsg('Entre para excluir certidões'); return }
    await supabase.from('user_certificates').delete().eq('id', id).eq('user_id', user.id)
    const { data } = await supabase
      .from('user_certificates')
      .select('id,certificate_name,expiry_date,notified')
      .eq('user_id', user.id)
      .order('expiry_date', { ascending: true })
    setCerts(data || [])
  }
  function daysLeft(dateStr: string): number {
    const d = new Date(dateStr)
    const today = new Date()
    const ms = d.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    return Math.ceil(ms / (24 * 60 * 60 * 1000))
  }
  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-900">Guia de Habilitação</h1>
            <p className="mt-1 text-sm text-gray-600">Prepare sua empresa para licitar</p>
          </div>
          <Link href="/" className="text-sm text-blue-800 hover:underline">Voltar</Link>
        </div>
        <div className="mb-6 rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-lg font-semibold text-blue-900">Meus Vencimentos</h2>
            <Sheet>
              <SheetTrigger asChild>
                <Button onClick={() => setAddOpen(true)} className="bg-gray-100 text-gray-800 hover:bg-gray-200 text-xs px-2 py-1">Adicionar Certidão</Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Adicionar Certidão</SheetTitle>
                </SheetHeader>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-600">Tipo</div>
                    <Select value={newName} onChange={(e) => setNewName(e.target.value)}>
                      <option value="CND Federal">CND Federal</option>
                      <option value="FGTS">FGTS</option>
                      <option value="Trabalhista">Trabalhista</option>
                      <option value="Estadual">Estadual</option>
                      <option value="Municipal">Municipal</option>
                      <option value="Outra">Outra</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-600">Data de Vencimento</div>
                    <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  </div>
                  {uiMsg ? <div className="text-xs text-red-600">{uiMsg}</div> : null}
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setAddOpen(false)} className="bg-gray-100 text-gray-800 hover:bg-gray-200">Fechar</Button>
                    <Button onClick={addCert} className="bg-blue-800 text-white hover:bg-blue-700">Salvar</Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="px-4 py-4">
            {loadingCerts ? (
              <div className="text-sm text-gray-600">Carregando...</div>
            ) : certs.length === 0 ? (
              <div className="text-sm text-gray-600">Nenhuma certidão cadastrada</div>
            ) : (
              <div className="flex flex-col gap-2">
                {certs.map((c) => {
                  const dl = daysLeft(c.expiry_date)
                  const warn = dl <= 5 && dl >= 0
                  const cls = warn ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
                  return (
                    <div key={c.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${cls}`}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-700" />
                        <div className="text-gray-800">{c.certificate_name}</div>
                        <div className="text-xs text-gray-600">vence em {dl} dia(s)</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-md border px-2 py-1 text-xs text-gray-700">{new Date(c.expiry_date).toLocaleDateString('pt-BR')}</div>
                        <Button onClick={() => delCert(c.id)} className="bg-transparent text-gray-500 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 rounded-xl border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-blue-700" />
              <h2 className="text-lg font-semibold text-blue-900">Passaporte SICAF</h2>
            </div>
            <Button
              onClick={() => { setRedirectInfo(true); setTimeout(() => setRedirectInfo(false), 2500); window.open('https://www.gov.br/compras/pt-br/sistemas/sicaf','_blank') }}
              className="bg-blue-800 text-white hover:bg-blue-700 text-xs"
            >
              <ExternalLink className="mr-1 h-4 w-4" />
              Acessar SICAF
            </Button>
          </div>
          {redirectInfo && (
            <div className="px-4 py-3">
              <Alert className="border-blue-200 bg-blue-50 text-blue-900">
                <AlertDescription>Você será redirecionado para o portal oficial do Governo Federal</AlertDescription>
              </Alert>
            </div>
          )}
          <div className="px-4 py-4">
            <Accordion
              single
              items={[
                {
                  id: 'p1',
                  title: <span><strong>Passo 1:</strong> Conta Gov.br</span>,
                  content: (
                    <div>
                      É necessário possuir conta Gov.br nível Prata ou Ouro para acessar o SICAF e assinar digitalmente cadastros.
                    </div>
                  ),
                },
                {
                  id: 'p2',
                  title: <span><strong>Passo 2:</strong> Preencher Nível I</span>,
                  content: (
                    <div>
                      Realize o cadastro inicial no Nível I do SICAF para liberar acesso aos editais federais e habilitar sua empresa.
                    </div>
                  ),
                },
                {
                  id: 'p3',
                  title: <span><strong>Passo 3:</strong> Upload de Documentos</span>,
                  content: (
                    <ul className="list-disc pl-4">
                      <li>Contrato Social</li>
                      <li>Balanço Patrimonial</li>
                      <li>Certidões Estaduais pertinentes</li>
                    </ul>
                  ),
                },
              ]}
            />
          </div>
          <div className="border-t px-4 py-4">
            <div className="rounded-md border bg-slate-50 p-3 text-sm text-gray-700">
              Após o cadastro, o SICAF renova automaticamente a CND Federal e o FGTS, reduzindo tarefas manuais recorrentes.
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-blue-900">Documentação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a href="https://www.gov.br/pt-br/servicos/emitir-certidao-de-debitos-relativos-a-tributos-federais-e-a-divida-ativa-da-uniao" target="_blank" rel="noreferrer" className="text-blue-800 hover:underline">CND Federal</a>
              <a href="https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf" target="_blank" rel="noreferrer" className="text-blue-800 hover:underline">CRF FGTS</a>
              <a href="https://www.gov.br/trabalho-e-emprego/pt-br/servicos/inspecao/consulta-de-situacao" target="_blank" rel="noreferrer" className="text-blue-800 hover:underline">CND Trabalhista</a>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-blue-900">Capacidade Técnica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="bg-gray-100 text-gray-800 hover:bg-gray-200 text-xs px-2 py-1">Modelo de Atestado</Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-lg">
                  <SheetHeader>
                    <SheetTitle>Atestado de Capacidade Técnica</SheetTitle>
                  </SheetHeader>
                  <div className="mt-3 rounded-md border bg-slate-50 p-3 text-xs text-gray-800">
                    {modeloAtestado}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button className="bg-gray-100 text-gray-800 hover:bg-gray-200">Fechar</Button>
                  </div>
                </SheetContent>
              </Sheet>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-blue-900">Portais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a href="https://www.gov.br/compras" target="_blank" rel="noreferrer" className="text-blue-800 hover:underline">Compras.gov.br</a>
              <a href="https://www1.tce.rs.gov.br/portal/page/portal/tcers/inicio/licitacon" target="_blank" rel="noreferrer" className="text-blue-800 hover:underline">LicitaCon/RS</a>
            </CardContent>
          </Card>
        </div>
      </main>
      <BottomNavigation />
    </div>
  )
}
