'use client'
import { useState } from 'react'
import { supabase, authRedirectTo } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  async function signInGoogle() {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectTo }
    })
  }
  async function sendMagicLink() {
    if (!supabase || !email) return
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: authRedirectTo }
    })
    setMessage(error ? 'Falha ao enviar link mágico' : 'Verifique seu e-mail para acessar')
  }
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm border bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/40">
        <CardHeader>
          <CardTitle className="text-center text-blue-900">LicitMASA</CardTitle>
        </CardHeader>
        <CardContent>
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
