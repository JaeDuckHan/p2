/**
 * Toast — 토스트 알림 UI 컴포넌트
 * ToastItem: 개별 토스트 알림 (아이콘 + 메시지 + 닫기 버튼, 4가지 타입: success/warning/error/info)
 * ToastContainer: 화면 상단 중앙에 고정되는 토스트 목록 컨테이너
 */

import { cn } from '@/lib/utils'
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'

const ICONS = {
  success: CheckCircle,
  warning: AlertTriangle,
  error:   XCircle,
  info:    Info,
}

const STYLES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  error:   'bg-red-50 border-red-200 text-red-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
}

const ICON_STYLES = {
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  error:   'text-red-500',
  info:    'text-blue-500',
}

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || Info

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg',
        'animate-slide-down max-w-[360px] w-full',
        STYLES[toast.type] || STYLES.info
      )}
    >
      <Icon className={cn('w-4.5 h-4.5 shrink-0', ICON_STYLES[toast.type])} />
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors cursor-pointer"
      >
        <XCircle className="w-3.5 h-3.5 opacity-40" />
      </button>
    </div>
  )
}

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}

export { ToastContainer, ToastItem }
