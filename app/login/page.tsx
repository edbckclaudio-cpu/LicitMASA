'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, authRedirectTo } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  async function signInGoogle() {
    if (!supabase) { setMessage('Configure o Supabase no .env'); return }
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/perfil` : authRedirectTo
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true }
      })
      if (error) { setMessage('Falha ao iniciar login com Google'); return }
      const url = String(data?.url || '')
      if (url && typeof window !== 'undefined') {
        window.location.href = url
        return
      }
      setMessage('Redirecionamento de login indisponível')
    } catch (e: any) {
      setMessage(e?.message || 'Falha ao iniciar login')
    }
  }
  async function sendMagicLink() {
    if (!supabase) { setMessage('Configure o Supabase no .env'); return }
    if (!email) return
    const emailRedirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/perfil` : authRedirectTo
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo }
    })
    setMessage(error ? 'Falha ao enviar link mágico' : 'Verifique seu e-mail para acessar')
  }
  async function signInPassword() {
    if (!supabase) { setMessage('Configure o Supabase no .env'); return }
    if (!email || !password) return
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setMessage(error.message || 'Falha ao entrar com senha'); return }
    router.push('/perfil')
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm border bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40">
        <CardHeader>
          <CardTitle className="text-center text-blue-900">LicitMASA</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Button onClick={() => router.push('/')} className="w-full bg-gray-100 text-gray-800 hover:bg-gray-200">
              Voltar para Tela Inicial
            </Button>
          </div>
          <div className="space-y-3">
            <Button onClick={signInGoogle} className="w-full bg-white text-gray-900 border hover:bg-gray-50">
              Continuar com Google
            </Button>
            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu e-mail"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <Button onClick={sendMagicLink} className="w-full bg-blue-800 text-white hover:bg-blue-700">
                Entrar com link mágico
              </Button>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <Button onClick={signInPassword} className="w-full bg-blue-900 text-white hover:bg-blue-800">
                Entrar com e-mail e senha
              </Button>
            </div>
            {message ? (
              <div className="text-center text-xs text-gray-700">{message}</div>
            ) : null}
          </div>
          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-gray-600">
            <Link href="/perfil?view=privacidade" className="hover:underline">Privacidade</Link>
            <span>•</span>
            <Link href="/perfil?view=termos" className="hover:underline">Termos</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
