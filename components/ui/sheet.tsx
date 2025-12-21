'use client'
import * as React from 'react'
import { createContext, useContext, useMemo, useState } from 'react'
import { cn } from './utils'

type SheetContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
}

const SheetCtx = createContext<SheetContextValue | null>(null)

export function Sheet({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return <SheetCtx.Provider value={value}>{children}</SheetCtx.Provider>
}

export function SheetTrigger({ asChild, children, className, ...props }: React.HTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const ctx = useContext(SheetCtx)!
  if (asChild) {
    const child = React.Children.only(children as React.ReactElement)
    return React.cloneElement(child as React.ReactElement, {
      ...props,
      onClick: (e: any) => {
        ctx.setOpen(true)
        if (typeof (child as any).props.onClick === 'function') (child as any).props.onClick(e)
      },
    })
  }
  return (
    <button
      {...props}
      onClick={() => ctx.setOpen(true)}
      className={cn('rounded-md border px-3 py-2 text-sm', className)}
    >
      {children}
    </button>
  )
}

export function SheetContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = useContext(SheetCtx)!
  return (
    <div className={cn('fixed inset-0 z-50', ctx.open ? '' : 'pointer-events-none')} aria-hidden={!ctx.open}>
      <div
        className={cn('absolute inset-0 bg-black/30 transition-opacity duration-300', ctx.open ? 'opacity-100' : 'opacity-0')}
        onClick={() => ctx.setOpen(false)}
      />
      <div
        {...props}
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-md translate-x-0 overflow-y-auto border-l bg-white shadow-lg transition-transform duration-300 ease-out',
          ctx.open ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('border-b px-4 py-3', className)} />
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('text-base font-semibold', className)} />
}
