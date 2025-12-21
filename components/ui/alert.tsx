import * as React from 'react'
import { cn } from './utils'

export function Alert({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('flex items-start gap-2 rounded-md border px-4 py-3', className)} />
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('text-sm font-semibold', className)} />
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('text-sm', className)} />
}
