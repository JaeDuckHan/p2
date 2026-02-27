/**
 * Avatar — 사용자 아바타 컴포넌트
 * 4가지 크기(sm/default/lg/xl)를 지원하는 원형 아바타입니다.
 * style prop으로 그라디언트 배경을 적용할 수 있으며, 지갑 주소 이니셜 문자 표시에 사용됩니다.
 */

import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const avatarVariants = cva(
  'inline-flex items-center justify-center rounded-full font-bold text-white shrink-0',
  {
    variants: {
      size: {
        sm:      'w-8 h-8 text-xs',
        default: 'w-10 h-10 text-sm',
        lg:      'w-12 h-12 text-base',
        xl:      'w-16 h-16 text-lg',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

function Avatar({ className, size, style, children, ...props }) {
  return (
    <div
      className={cn(avatarVariants({ size }), className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  )
}

export { Avatar }
