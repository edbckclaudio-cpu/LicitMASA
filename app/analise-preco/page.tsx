'use client'
import { Suspense, useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { fetchContratacoesPage, formatDateYYYYMMDD } from '@/lib/pncp'
import { ChevronLeft, Search } from 'lucide-react'
import Link from 'next/link'

function getField(o: any, keys: string[], fallback?: any) {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null) return o[k]
  }
  return fallback
}

function formatCurrencyBRL(value: number | string | undefined) {
  const num = typeof value === 'string' ? Number(value) : value
  if (!num || Number.isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

const STOPWORDS = new Set([
  'de','da','do','das','dos','e','para','com','em','por','sem','se','uma','um','as','os','a','o','ao','à',
  'contratação','prestação','serviços','serviço','aquisição','compra','fornecimento','empresa','material','materiais',
  'execução','objeto','itens','item'
])

function extractKeywords(obj: string) {
  const words = obj
    .toLowerCase()
    .replace(/[.,;:()\/\-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w) && w.length > 3)
  const unique = Array.from(new Set(words))
  const sorted = unique.sort((a, b) => b.length - a.length)
  const top = sorted.slice(0, Math.min(3, sorted.length))
  return top.join(' ')
}

function AnalisePrecoContent() {
  const params = useSearchParams()
  const objetoParam = params.get('obj') || ''
  const [objeto, setObjeto] = useState<string>(objetoParam)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<any[]>([])
  const hoje = useMemo(() => formatDateYYYYMMDD(new Date()), [])
  const termo = useMemo(() => extractKeywords(objeto || ''), [objeto])

  const buscar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await fetchContratacoesPage({
        dataInicial: '20240101',
        dataFinal: hoje,
        termo: termo || undefined,
        pagina: 1,
        tamanhoPagina: 20,
      })
      const list = Array.isArray(page.items) ? page.items : []
      const filtered = list.filter((it: any) => {
        const status = String(
          getField(it, ['situacaoCompra','statusCompra','situacao','status','fase','etapa'], '')
        ).toLowerCase()
        return status.includes('homolog')
      })
      setResultados(filtered)
    } catch {
      setError('Falha ao consultar preços históricos')
      setResultados([])
    } finally {
      setLoading(false)
    }
  }, [termo, hoje])

  useEffect(() => {
    if (termo) buscar()
  }, [termo, buscar])

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link href="/" className="inline-flex items-center gap-1 text-blue-800 hover:underline">
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Link>
            <span className="text-sm text-gray-600">Análise de Preço</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr,auto] md:items-start">
            <div className="space-y-2">
              <div className="text-xs text-gray-600">Objeto selecionado</div>
              <Input
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
                placeholder="Descreva o objeto (ex: uniformes escolares)"
              />
              <div className="text-xs text-gray-500">Palavras-chave: {termo || '—'}</div>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={buscar} disabled={loading} className="bg-blue-800 text-white hover:bg-blue-700">
                {loading ? <Search className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? 'Buscando...' : 'Buscar preços'}
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-blue-900">{objeto || 'Objeto'}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          <div className="mt-4">
            {loading && (
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-blue-800">
                <Search className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            )}
            {!loading && resultados.length === 0 && (
              <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-700">
                Não encontramos preços históricos para este termo específico. Tente uma busca manual por &apos;Uniformes&apos;.
              </div>
            )}
            {!loading && resultados.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {resultados.map((item: any, idx: number) => {
                  const objHist = String(getField(item, ['objeto','descricao','resumo','texto'], ''))
                  const orgao = String(getField(item, ['orgao','orgaoPublico','nomeUnidadeAdministrativa','uasgNome','entidade'], ''))
                  const uf =
                    String(getField(item, ['uf','ufSigla'], '')) ||
                    String(getField(getField(item, ['unidadeOrgao'], {}), ['ufSigla'], ''))
                  const valor = getField(item, ['valorHomologado','valorHomologacao','valorTotalHomologado','valor'], 0)
                  const dataHom = String(getField(item, ['dataHomologacao','dataHomologado','dataPublicacao','data'], '')).slice(0, 10)
                  const empresa = String(getField(item, ['razaoSocialContratada','nomeVencedor','fornecedor','empresaVencedora','contratada'], ''))
                  return (
                    <Card key={idx} className="border">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-800">Homologado</Badge>
                          <CardTitle className="text-base truncate">{objHist || 'Objeto'}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm text-gray-800">
                          <div><span className="text-gray-600">Órgão:</span> {orgao || '—'}</div>
                          <div><span className="text-gray-600">UF:</span> {uf || '—'}</div>
                          <div><span className="text-gray-600">Empresa vencedora:</span> {empresa || '—'}</div>
                          <div><span className="text-gray-600">Valor homologado:</span> {formatCurrencyBRL(valor)}</div>
                          <div><span className="text-gray-600">Data da homologação:</span> {dataHom || '—'}</div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
export default function AnalisePrecoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AnalisePrecoContent />
    </Suspense>
  )
}
