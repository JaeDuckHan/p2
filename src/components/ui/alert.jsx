/**
 * Alert — 알림 메시지 컴포넌트
 * Alert, AlertTitle, AlertDescription으로 구성되며,
 * 5가지 변형(default/success/warning/destructive/info)을 지원합니다.
 */

import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-xl border p-3 text-sm',
  {
    variants: {
      variant: {
        default:     'bg-slate-50 border-slate-200 text-slate-700',
        success:     'bg-emerald-50 border-emerald-200 text-emerald-800',
        warning:     'bg-amber-50 border-amber-200 text-amber-800',
        destructive: 'bg-red-50 border-red-200 text-red-800',
        info:        'bg-blue-50 border-blue-200 text-blue-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const Alert = forwardRef(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
))
Alert.displayName = 'Alert'

const AlertTitle = forwardRef(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn('mb-1 font-semibold leading-none', className)} {...props} />
))
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm leading-relaxed [&_p]:leading-relaxed', className)} {...props} />
))
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
