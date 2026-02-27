/**
 * Input — 입력 필드 컴포넌트
 * 기본 Input과 오른쪽에 단위 접미사를 표시하는 InputWithUnit을 제공합니다.
 * 포커스 링, 비활성화 스타일을 포함합니다.
 */

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const Input = forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm',
      'placeholder:text-slate-400',
      'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
      'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
      'transition-colors',
      className
    )}
    ref={ref}
    {...props}
  />
))
Input.displayName = 'Input'

const InputWithUnit = forwardRef(({ className, unit, ...props }, ref) => (
  <div className={cn('relative flex items-center', className)}>
    <input
      className={cn(
        'flex h-11 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-14 py-2 text-sm font-medium',
        'placeholder:text-slate-400',
        'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50',
        'transition-colors',
      )}
      ref={ref}
      {...props}
    />
    {unit && (
      <span className="absolute right-3 text-sm font-medium text-slate-400 pointer-events-none">
        {unit}
      </span>
    )}
  </div>
))
InputWithUnit.displayName = 'InputWithUnit'

export { Input, InputWithUnit }
