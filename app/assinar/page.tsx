'use client'
import { Bell, FileText, MessageCircle, SearchCheck, Bookmark, ShieldCheck, Star } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function AssinarPage() {
  const payUrl = process.env.NEXT_PUBLIC_PAYMENT_URL || '/perfil'
  const price = process.env.NEXT_PUBLIC_PLAN_PRICE || '49,90'
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-blue-900">Plano Premium</h1>
          <Link href="/" className="text-sm text-blue-700 hover:underline">Voltar</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-6 md:grid-cols-[1fr,380px]">
          <Card className="shadow-sm border-blue-100">
            <CardHeader>
              <CardTitle className="text-2xl text-blue-900">Desbloqueie o Poder Total do LicitMASA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4">
                <div className="flex items-center gap-2 text-yellow-700">
                  <Star className="h-5 w-5 text-yellow-600" />
                  Benefícios Premium
                </div>
                <div className="mt-3 grid gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <Bell className="h-4 w-4 text-yellow-600" />
                    Alertas em Tempo Real: notificações nativas às 07:00 e 16:00 com as melhores oportunidades.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <FileText className="h-4 w-4 text-yellow-600" />
                    Acesso aos Editais: download e visualização de editais completos.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <MessageCircle className="h-4 w-4 text-yellow-600" />
                    Compartilhamento Profissional: envie licitações formatadas via WhatsApp.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <SearchCheck className="h-4 w-4 text-yellow-600" />
                    Raio-X da Oportunidade: análise profunda e inteligente de cada licitação.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <Bookmark className="h-4 w-4 text-yellow-600" />
                    Favoritos Ilimitados: salve e organize todas as oportunidades sem restrições.
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-blue-100 bg-white p-4">
                <div className="flex items-center gap-2 text-blue-900">
                  <ShieldCheck className="h-5 w-5 text-blue-700" />
                  Regras de Acesso
                </div>
                <div className="mt-2 text-sm text-slate-800">
                  Usuários do plano gratuito podem buscar licitações. Recursos avançados como Ver Edital, WhatsApp, Raio‑X e Alertas Automáticos são exclusivos do Premium.
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-blue-100">
            <CardHeader>
              <CardTitle className="text-blue-900">Assine por R$ {price}/mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                Acesso imediato após confirmação do pagamento.
              </div>
              <Link href={payUrl} className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                Assinar Agora
              </Link>
              <div className="mt-3 text-center text-xs text-slate-500">
                Cancelamento simples a qualquer momento.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
