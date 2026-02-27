/**
 * Banner — 정보 배너 컴포넌트
 * 아이콘 + 제목 + 내용으로 구성되며, 5가지 색상 변형(default/success/warning/destructive/info)을
 * 지원하는 블록 형태의 안내 메시지 UI입니다.
 */

import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const bannerVariants = cva(
  'flex items-start gap-3 rounded-xl p-3.5 text-sm',
  {
    variants: {
      variant: {
        default:     'bg-primary-50 text-primary-800 border border-primary-100',
        success:     'bg-emerald-50 text-emerald-800 border border-emerald-100',
        warning:     'bg-amber-50 text-amber-800 border border-amber-100',
        destructive: 'bg-red-50 text-red-800 border border-red-100',
        info:        'bg-blue-50 text-blue-800 border border-blue-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

function Banner({ className, variant, icon, title, children, ...props }) {
  return (
    <div className={cn(bannerVariants({ variant }), className)} {...props}>
      {icon && <span className="text-base shrink-0 mt-0.5">{icon}</span>}
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  )
}

export { Banner }
