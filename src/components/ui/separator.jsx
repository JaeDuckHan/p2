/**
 * Separator — 구분선 컴포넌트
 * border-slate-200 색상의 얇은 수평 hr 구분선입니다.
 */

import { cn } from '@/lib/utils'

function Separator({ className, ...props }) {
  return (
    <hr
      className={cn('border-0 border-t border-slate-200 my-3', className)}
      {...props}
    />
  )
}

export { Separator }
