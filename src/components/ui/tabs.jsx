/**
 * Tabs — 탭 네비게이션 컴포넌트
 * Context 기반으로 동작하며 Tabs, TabsList, TabsTrigger, TabsContent로 구성됩니다.
 * 활성 탭 아래 인디케이터 바(border-b)로 선택 상태를 표시합니다.
 */

import { createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

const TabsContext = createContext({ value: '', onChange: () => {} })

function Tabs({ value, onChange, children, className }) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className }) {
  return (
    <div className={cn('flex gap-0 border-b border-slate-200', className)}>
      {children}
    </div>
  )
}

function TabsTrigger({ value, children, className }) {
  const ctx = useContext(TabsContext)
  const isActive = ctx.value === value

  return (
    <button
      type="button"
      className={cn(
        'relative px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer',
        isActive
          ? 'text-primary-600'
          : 'text-slate-500 hover:text-slate-700',
        className
      )}
      onClick={() => ctx.onChange(value)}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full" />
      )}
    </button>
  )
}

function TabsContent({ value, children, className }) {
  const ctx = useContext(TabsContext)
  if (ctx.value !== value) return null
  return <div className={cn('animate-fade-in', className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
