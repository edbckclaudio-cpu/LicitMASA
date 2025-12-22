'use client'
import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter, useSearchParams } from 'next/navigation'

function PerfilContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    async function load() {
      if (!supabase) { router.push('/login'); return }
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        router.push('/login')
        return
      }
      setUserEmail(user.email || null)
      const v = sp.get('view')
      if (v === 'termos') setShowTerms(true)
      if (v === 'privacidade') setShowPrivacy(true)
    }
    load()
  }, [])

  async function logout() {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function deleteAccount() {
    setConfirmDelete(false)
    alert('Para excluir sua conta, entre em contato pelo WhatsApp de suporte: +55 11 99999-9999. Seus dados podem ser exportados ou removidos conforme LGPD.')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-blue-900">Perfil</h1>
          <Button onClick={logout} className="bg-gray-100 text-gray-800 hover:bg-gray-200">Sair</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-900">Configurações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              <div className="flex items-center justify-between py-3">
                <div className="text-sm">
                  <div className="font-medium text-gray-900">Meus Dados</div>
                  <div className="text-gray-700">{userEmail || '-'}</div>
                </div>
              </div>
              <button className="flex w-full items-center justify-between py-3 text-left hover:bg-gray-50 px-2 rounded-md" onClick={() => setShowTerms(true)}>
                <div className="text-sm font-medium text-gray-900">Termos de Uso</div>
                <span className="text-xs text-blue-700">Abrir</span>
              </button>
              <button className="flex w-full items-center justify-between py-3 text-left hover:bg-gray-50 px-2 rounded-md" onClick={() => setShowPrivacy(true)}>
                <div className="text-sm font-medium text-gray-900">Política de Privacidade</div>
                <span className="text-xs text-blue-700">Abrir</span>
              </button>
              <a href="https://wa.me/5511999999999" target="_blank" rel="noreferrer" className="flex w-full items-center justify-between py-3 text-left hover:bg-gray-50 px-2 rounded-md">
                <div className="text-sm font-medium text-gray-900">Suporte e Contato</div>
                <span className="text-xs text-blue-700">WhatsApp</span>
              </a>
              <div className="flex w-full items-center justify-between py-3 text-left px-2 rounded-md">
                <div className="text-sm">
                  <div className="font-medium text-gray-900">Segurança dos Dados</div>
                  <div className="text-gray-700 text-xs">Dados protegidos via Supabase/PostgreSQL com criptografia em repouso e em trânsito.</div>
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="text-sm font-medium text-red-700">Excluir Minha Conta</div>
                <Button onClick={() => setConfirmDelete(true)} className="bg-red-600 text-white hover:bg-red-700">Excluir</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={"fixed inset-0 z-50 " + (showTerms ? '' : 'pointer-events-none')}>
          <div className={"absolute inset-0 bg-black/40 transition-opacity duration-300 " + (showTerms ? 'opacity-100' : 'opacity-0')} onClick={() => setShowTerms(false)} />
          <div className={"absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border bg-white p-6 shadow-lg transition-transform duration-300 ease-out " + (showTerms ? 'translate-y-0' : 'translate-y-full')}>
            <div className="text-lg font-semibold text-blue-900 mb-2">Termos de Uso</div>
            <div className="text-sm text-gray-800">
              O LicitMASA é uma ferramenta de produtividade que consome dados públicos do portal PNCP. Não temos vínculo com o Governo Federal. O usuário é responsável pela verificação das informações diretamente nos editais oficiais. O uso do app implica na aceitação da coleta mínima de dados para funcionamento do sistema de favoritos.
            </div>
            <div className="mt-4 flex items-center justify-end">
              <Button onClick={() => setShowTerms(false)} className="bg-gray-100 text-gray-800 hover:bg-gray-200">Fechar</Button>
            </div>
          </div>
        </div>
        <div className={"fixed inset-0 z-50 " + (showPrivacy ? '' : 'pointer-events-none')}>
          <div className={"absolute inset-0 bg-black/40 transition-opacity duration-300 " + (showPrivacy ? 'opacity-100' : 'opacity-0')} onClick={() => setShowPrivacy(false)} />
          <div className={"absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border bg-white p-6 shadow-lg transition-transform duration-300 ease-out " + (showPrivacy ? 'translate-y-0' : 'translate-y-full')}>
            <div className="text-lg font-semibold text-blue-900 mb-2">Política de Privacidade</div>
            <div className="text-sm text-gray-800">
              O LicitMASA coleta seu e-mail para autenticação e armazena suas licitações favoritas para sua conveniência. Seus dados são protegidos via Supabase/PostgreSQL e nunca são compartilhados com terceiros. Você tem o direito de exportar ou excluir seus dados a qualquer momento nas configurações do app.
            </div>
            <div className="mt-4 flex items-center justify-end">
              <Button onClick={() => setShowPrivacy(false)} className="bg-gray-100 text-gray-800 hover:bg-gray-200">Fechar</Button>
            </div>
          </div>
        </div>

        <div className={"fixed inset-0 z-50 " + (confirmDelete ? '' : 'pointer-events-none')}>
          <div className={"absolute inset-0 bg-black/40 transition-opacity duration-300 " + (confirmDelete ? 'opacity-100' : 'opacity-0')} onClick={() => setConfirmDelete(false)} />
          <div className={"absolute bottom-0 left-0 right-0 max-h-[50vh] overflow-y-auto rounded-t-2xl border bg-white p-6 shadow-lg transition-transform duration-300 ease-out " + (confirmDelete ? 'translate-y-0' : 'translate-y-full')}>
            <div className="text-lg font-semibold text-blue-900 mb-2">Excluir Conta</div>
            <div className="text-sm text-gray-800">
              Tem certeza? Todos os seus favoritos e alertas serão apagados permanentemente.
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button onClick={() => setConfirmDelete(false)} className="bg-gray-100 text-gray-800 hover:bg-gray-200">Cancelar</Button>
              <Button onClick={deleteAccount} className="bg-red-600 text-white hover:bg-red-700">Confirmar</Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function PerfilPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-700">Carregando perfil...</div></div>}>
      <PerfilContent />
    </Suspense>
  )
}
