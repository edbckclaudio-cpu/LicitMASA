'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const ServiceWorkerRegister = dynamic(() => import('@/components/ServiceWorkerRegister'), {
  ssr: false,
})

type AppShellProps = {
  children: ReactNode
}

/**
 * Shell de hidratacao segura para o App Router.
 *
 * Mantem o layout SSR minimo e so revela o conteudo cliente depois que o
 * navegador monta a arvore. Isso reduz mismatch de hidratacao em componentes
 * que dependem de APIs do browser, como OneSignal e integrações PWA/TWA.
 */
export default function AppShell({ children }: AppShellProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Buscando...
      </div>
    )
  }

  return (
    <>
      <ServiceWorkerRegister />
      {children}
    </>
  )
}
