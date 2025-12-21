import * as React from 'react'
import { cn } from './utils'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ className, ...props }: ButtonProps) {
  const hasTextColor =
    typeof className === 'string' &&
    /\btext-(?:white|black|current|inherit|gray-\d+|blue-\d+|red-\d+|green-\d+|yellow-\d+|neutral-\d+|slate-\d+|zinc-\d+)\b/.test(
      className
    )
  const hasLightBg =
    typeof className === 'string' &&
    /\bbg-(?:white|gray-50|gray-100|gray-200|slate-50|blue-50|blue-100)\b/.test(className)
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md border border-transparent bg-blue-800 px-4 text-sm font-medium transition-colors hover:bg-blue-700 focus:outline-none disabled:pointer-events-none disabled:opacity-50',
        !hasTextColor ? (hasLightBg ? 'text-gray-800' : 'text-white') : '',
        className
      )}
    />
  )
}
