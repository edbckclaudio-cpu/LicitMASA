'use client'
import * as React from 'react'
import Link from 'next/link'
import { Home, Bookmark, ClipboardList } from 'lucide-react'
import { cn } from './utils'

export function BottomNavigation({ className }: { className?: string }) {
  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:hidden',
        className
      )}
      aria-label="Navegação inferior"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2">
        <Link
          href="/"
          className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs text-blue-900 hover:bg-blue-50"
        >
          <Home className="h-5 w-5 text-blue-700" />
          Início
        </Link>
        <Link
          href="/favoritos"
          className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs text-blue-900 hover:bg-blue-50"
        >
          <Bookmark className="h-5 w-5 text-blue-700" />
          Favoritos
        </Link>
        <Link
          href="/preparacao"
          className="flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs text-blue-900 hover:bg-blue-50"
        >
          <ClipboardList className="h-5 w-5 text-blue-700" />
          Preparação
        </Link>
      </div>
    </nav>
  )
}
