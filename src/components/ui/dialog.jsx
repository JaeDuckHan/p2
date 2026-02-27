/**
 * Dialog — 모달/대화상자 컴포넌트
 * Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose로 구성됩니다.
 * 배경 오버레이 클릭 및 Escape 키로 닫기, 열림 시 스크롤 잠금 기능을 제공합니다.
 */

import { useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

function Dialog({ open, onClose, children }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose?.()
  }, [onClose])

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative z-50 animate-slide-up">{children}</div>
    </div>
  )
}

function DialogContent({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'w-full max-w-sm bg-white rounded-2xl shadow-xl p-5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogHeader({ className, ...props }) {
  return <div className={cn('mb-4', className)} {...props} />
}

function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-lg font-bold text-slate-900', className)} {...props} />
}

function DialogDescription({ className, ...props }) {
  return <p className={cn('text-sm text-slate-500 mt-1', className)} {...props} />
}

function DialogClose({ className, onClick, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full',
        'text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer',
        className
      )}
      onClick={onClick}
      {...props}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    </button>
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose }
