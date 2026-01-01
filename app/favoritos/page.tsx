'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Favorite = {
  id?: string
  user_id: string
  pncp_id: string
  objeto_resumo: string
  orgao_nome: string
  valor_estimado?: number
  link_edital: string
  data_abertura?: string
}

function currencyBRL(v: number) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0))
  } catch {
    return `R$ ${Number(v || 0).toFixed(2)}`
  }
}

export default function FavoritosPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        setUserId(null)
        router.push('/login')
        return
      }
      setUserId(user.id)
      setLoading(true)
      const { data } = await supabase
        .from('user_favorites')
        .select('id,user_id,pncp_id,objeto_resumo,orgao_nome,valor_estimado,link_edital,data_abertura')
        .eq('user_id', user.id)
        .order('id', { ascending: false })
      setItems((data || []) as Favorite[])
      setLoading(false)
    }
    load()
  }, [router])

  function exportCSV() {
    const headers = ['Órgão','Objeto','Valor','PNCP ID','Link','Data Abertura']
    const rows = items.map((fav) => [
      fav.orgao_nome || '',
      (fav.objeto_resumo || '').replace(/\s+/g, ' ').trim(),
      String(Number(fav.valor_estimado || 0)),
      fav.pncp_id || '',
      fav.link_edital || '',
      fav.data_abertura ? new Date(fav.data_abertura).toISOString() : ''
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'licitacoes_favoritas.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-600" />
            <h1 className="text-xl font-semibold text-blue-900">Minhas Licitações</h1>
          </div>
          {userId && items.length > 0 && (
            <Button onClick={exportCSV} className="bg-blue-800 text-white hover:bg-blue-700 text-xs">Exportar CSV</Button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {!userId && (
          <div className="rounded-lg border bg-white p-12 text-center text-sm text-gray-700">
            Faça login para salvar e visualizar suas licitações favoritas
          </div>
        )}
        {userId && loading && (
          <div className="rounded-lg border bg-white p-12 text-center text-sm text-gray-700">
            Carregando...
          </div>
        )}
        {userId && !loading && items.length === 0 && (
          <div className="rounded-lg border bg-white p-12 text-center text-sm text-gray-700">
            Você ainda não favoritou nenhuma licitação
          </div>
        )}
        {userId && !loading && items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((fav) => (
              <Card key={fav.id || fav.pncp_id} className="transition-shadow hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm text-blue-900">
                    {fav.orgao_nome}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-gray-800">
                    <div className="rounded-md border bg-slate-50 px-3 py-2">{fav.objeto_resumo || 'Objeto indisponível'}</div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-md border px-2 py-1 text-xs text-gray-700">{currencyBRL(Number(fav.valor_estimado || 0))}</span>
                      <a
                        href={fav.link_edital || 'https://pncp.gov.br/'}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        <FileText className="h-4 w-4" />
                        Ver Edital
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
