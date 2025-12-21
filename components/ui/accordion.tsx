'use client'
import * as React from 'react'
import { cn } from './utils'

type Item = {
  id: string
  title: React.ReactNode
  content: React.ReactNode
}

export function Accordion({
  items,
  className,
  defaultOpenId,
  single = true,
}: {
  items: Item[]
  className?: string
  defaultOpenId?: string
  single?: boolean
}) {
  const [openIds, setOpenIds] = React.useState<string[]>(() =>
    defaultOpenId ? [defaultOpenId] : []
  )
  function toggle(id: string) {
    setOpenIds((prev) => {
      const has = prev.includes(id)
      if (single) {
        return has ? [] : [id]
      }
      return has ? prev.filter((x) => x !== id) : [...prev, id]
    })
  }
  return (
    <div className={cn('rounded-md border bg-white', className)}>
      {items.map((it, idx) => {
        const open = openIds.includes(it.id)
        return (
          <div key={it.id} className={cn('border-b', idx === items.length - 1 ? 'border-b-0' : '')}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(it.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-blue-900 hover:bg-blue-50"
            >
              <span>{it.title}</span>
              <span className={cn('transition-transform', open ? 'rotate-180' : '')}>▾</span>
            </button>
            <div
              className={cn(
                'px-4 pb-3 text-sm text-gray-700',
                open ? 'block' : 'hidden'
              )}
            >
              {it.content}
            </div>
          </div>
        )
      })}
    </div>
  )
}
