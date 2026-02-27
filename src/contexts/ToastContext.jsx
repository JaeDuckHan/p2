/**
 * ToastContext — 토스트 알림 전역 컨텍스트
 *
 * ToastProvider: 앱 전체에 toast/dismiss 함수를 제공하고 ToastContainer를 렌더링합니다.
 *   - 각 토스트는 고유 id를 부여받으며, duration(기본 3000ms) 후 자동 소멸합니다.
 *   - timers ref로 타이머를 관리하여 수동 dismiss 시 메모리 누수를 방지합니다.
 *
 * useToast(): toast(message, type, duration) / dismiss(id) 함수를 반환하는 커스텀 훅
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { ToastContainer } from '@/components/ui/toast'

// 토스트 컨텍스트 (초기값 null, Provider 없이 사용 시 에러 발생)
const ToastContext = createContext(null)

// 토스트 고유 ID 카운터 (전역 변수로 단조 증가)
let nextId = 1

/**
 * ToastProvider — 토스트 상태와 제어 함수를 하위 컴포넌트에 공급하는 Provider
 *
 * @param {React.ReactNode} children
 */
export function ToastProvider({ children }) {
  // 현재 화면에 표시 중인 토스트 목록
  const [toasts, setToasts] = useState([])
  // 각 토스트의 자동 소멸 타이머를 id를 키로 저장
  const timers = useRef({})

  /**
   * 특정 id의 토스트를 제거하고 연관 타이머를 정리
   * @param {number} id
   */
  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  /**
   * 새 토스트를 추가하고 자동 소멸 타이머를 등록
   * @param {string} message   - 표시할 메시지
   * @param {string} type      - 'info' | 'success' | 'warning' | 'error'
   * @param {number} duration  - 자동 소멸 시간(ms), 0이면 수동 닫기만 가능
   * @returns {number} 생성된 토스트 id
   */
  const toast = useCallback((message, type = 'info', duration = 3000) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])

    // duration이 양수인 경우에만 자동 소멸 타이머 등록
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration)
    }

    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* 토스트 목록 렌더링 — 화면 상단 고정 */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

/**
 * useToast — 토스트 제어 훅
 * ToastProvider 하위에서만 사용 가능합니다.
 * @returns {{ toast: Function, dismiss: Function }}
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
