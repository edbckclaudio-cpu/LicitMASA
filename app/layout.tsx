'use client'
import './globals.css'
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  const missingEnv =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50 antialiased">
        {missingEnv && (
          <div className="w-full bg-yellow-50 border-b border-yellow-200 text-yellow-900">
            <div className="mx-auto max-w-5xl px-6 py-3 text-sm">
              Ambiente não configurado: defina <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> e <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> em <code className="font-mono">.env.local</code>.
            </div>
          </div>
        )}
        {children}
      </body>
    </html>
  )
}
