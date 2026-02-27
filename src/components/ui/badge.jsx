/**
 * Badge — 상태 뱃지 컴포넌트
 * 7가지 변형(default/success/warning/destructive/info/secondary/outline)을 지원하는
 * 인라인 알약(pill) 형태의 레이블입니다.
 */

import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-primary-100 text-primary-700',
        success:     'bg-emerald-100 text-emerald-700',
        warning:     'bg-amber-100 text-amber-700',
        destructive: 'bg-red-100 text-red-700',
        info:        'bg-blue-100 text-blue-700',
        secondary:   'bg-slate-100 text-slate-600',
        outline:     'border border-slate-200 text-slate-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
