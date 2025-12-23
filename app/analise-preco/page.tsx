'use client'
import { useMemo, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import Link from 'next/link'
import { BottomNavigation } from '@/components/ui/bottom-navigation'

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

function currencyBRL(v: number) {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0)) } catch { return `R$ ${Number(v || 0).toFixed(2)}` }
}

export default function AnalisePrecoPage() {
  const [produto, setProduto] = useState('')
  const [uf, setUf] = useState<string>('')
  const [valorBase, setValorBase] = useState<string>('0')
  const [quantidade, setQuantidade] = useState<string>('1')
  const total = useMemo(() => {
    const v = Number(String(valorBase).replace(',', '.')) || 0
    const q = Number(String(quantidade).replace(',', '.')) || 1
    return Math.max(0, v * q)
  }, [valorBase, quantidade])
  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-900">Análise de Preço</h1>
            <p className="mt-1 text-sm text-gray-600">Simule valores de referência por item</p>
          </div>
          <Link href="/" className="text-sm text-blue-800 hover:underline">Voltar</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Card className="shadow-sm border">
          <CardHeader>
            <CardTitle className="text-blue-900">Parâmetros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase">Produto</label>
                <Input placeholder="Ex: Detergente neutro" value={produto} onChange={(e) => setProduto(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase">UF</label>
                <Select value={uf} onChange={(e) => setUf(e.target.value)}>
                  <option value="">Selecione</option>
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase">Valor unitário</label>
                <Input placeholder="Ex: 4,90" value={valorBase} onChange={(e) => setValorBase(e.target.value.replace(/[^\d.,]/g, ''))} />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase">Quantidade</label>
                <Input placeholder="Ex: 100" value={quantidade} onChange={(e) => setQuantidade(e.target.value.replace(/[^\d.,]/g, ''))} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button onClick={() => { setProduto(''); setUf(''); setValorBase('0'); setQuantidade('1') }} className="bg-gray-100 text-gray-800 hover:bg-gray-200">Limpar</Button>
              <Button className="bg-blue-800 text-white hover:bg-blue-700">Calcular</Button>
            </div>
          </CardContent>
        </Card>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border">
            <CardHeader>
              <CardTitle className="text-blue-900">Resultado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-800">
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-800">{uf || 'UF'}</Badge>
                  <div className="rounded-md border px-2 py-1 text-xs">{produto || 'Produto'}</div>
                </div>
                <div className="rounded-md border bg-slate-50 px-3 py-2">
                  Valor total estimado: <span className="font-semibold text-blue-900">{currencyBRL(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <BottomNavigation />
    </div>
  )
}
