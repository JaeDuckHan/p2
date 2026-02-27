/**
 * Button — CVA 기반 버튼 컴포넌트
 * 8가지 변형(default/success/info/warning/destructive/outline/ghost/link)과
 * 3가지 크기(sm/default/lg)를 지원합니다.
 */

import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-150 cursor-pointer disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:     'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
        success:     'bg-success text-white hover:bg-success-dark shadow-sm',
        info:        'bg-info text-white hover:bg-info-dark shadow-sm',
        warning:     'bg-warning text-white hover:bg-warning-dark shadow-sm',
        destructive: 'bg-danger text-white hover:bg-danger-dark shadow-sm',
        outline:     'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300',
        ghost:       'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        link:        'text-primary-600 underline-offset-4 hover:underline',
      },
      size: {
        sm:      'h-8 px-3 text-xs rounded-lg',
        default: 'h-10 px-4 text-sm',
        lg:      'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = forwardRef(({ className, variant, size, ...props }, ref) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
