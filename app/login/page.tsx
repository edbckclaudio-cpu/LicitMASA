'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, authRedirectTo, buildAuthRedirect } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function LoginPage() {
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  async function signInGoogle() {
    if (!supabase) { setMessage('Configure o Supabase no .env'); return }
    const redirectTo = buildAuthRedirect('/perfil')
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
