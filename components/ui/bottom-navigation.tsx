'use client'
import * as React from 'react'
import Link from 'next/link'
import { Home, Bookmark, ClipboardList, User } from 'lucide-react'
import { cn } from './utils'

export function BottomNavigation({ className }: { className?: string }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const startYRef = React.useRef<number | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  function bump() {
    setCollapsed(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCollapsed(true), 5000)
  }
  React.useEffect(() => {
    bump()
    const onAny = () => bump()
    window.addEventListener('touchstart', onAny, { passive: true })
    window.addEventListener('scroll', onAny, { passive: true })
    window.addEventListener('mousemove', onAny)
    window.addEventListener('keydown', onAny)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      window.removeEventListener('touchstart', onAny)
      window.removeEventListener('scroll', onAny)
      window.removeEventListener('mousemove', onAny)
      window.removeEventListener('keydown', onAny)
    }
  }, [])
  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    startYRef.current = e.touches[0]?.clientY ?? null
  }
  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const y = e.changedTouches[0]?.clientY ?? null
    if (startYRef.current !== null && y !== null) {
      const dy = startYRef.current - y
      if (dy > 20) {
        setCollapsed(false)
        bump()
      }
    }
    startYRef.current = null
  }
  return (
    <>
      {collapsed && (
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onClick={() => { setCollapsed(false); bump() }}
          className="fixed bottom-1 left-1/2 z-40 -translate-x-1/2 rounded-full bg-gray-300/90 w-10 h-1 md:hidden"
        />
      )}
      <nav
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden transition-transform duration-300',
          collapsed ? 'translate-y-full' : 'translate-y-0',
          className
        )}
        aria-label="Navegação inferior"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2">
          <Link
            href="/"
            onClick={bump}
            className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs text-blue-900 hover:bg-blue-50"
          >
            <Home className="h-5 w-5 text-blue-700" />
            Início
          </Link>
          <Link
            href="/favoritos"
            onClick={bump}
            className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs text-blue-900 hover:bg-blue-50"
          >
            <Bookmark className="h-5 w-5 text-blue-700" />
            Favoritos
          </Link>
          <Link
            href="/perfil"
            onClick={bump}
            className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs text-blue-900 hover:bg-blue-50"
          >
            <User className="h-5 w-5 text-blue-700" />
            Perfil
          </Link>
          <Link
            href="/preparacao"
            onClick={bump}
            className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs text-blue-900 hover:bg-blue-50"
          >
            <ClipboardList className="h-5 w-5 text-blue-700" />
            Preparação
          </Link>
        </div>
      </nav>
    </>
  )
}
