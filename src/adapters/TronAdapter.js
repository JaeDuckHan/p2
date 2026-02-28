/**
 * TronAdapter.js — Tron(TronLink) 지갑 어댑터
 *
 * window.tronWeb / window.tronLink를 래핑하여 통합 지갑 인터페이스를 제공한다.
 *
 * TronLink 주입 지연 대응:
 *   1. 초기 로드 시 window.tronWeb 체크
 *   2. 없으면 1초 간격 재시도 (최대 5회)
 *   3. window focus/visibilitychange 시 재감지
 *   4. 컴포넌트 언마운트 시 cleanup (인터벌/리스너 해제)
 */
import { useState, useEffect, useCallback, useRef } from 'react'

const MAX_RETRIES = 5
const RETRY_INTERVAL = 1000

/**
 * TronLink 설치 여부 감지
 * @returns {boolean}
 */
function detectTronLink() {
  return typeof window !== 'undefined' && (
    window.tronWeb?.ready || window.tronLink != null
  )
}

/**
 * TronLink에서 현재 연결된 주소 반환
 * @returns {string|null}
 */
function getTronAddress() {
  if (!window.tronWeb?.ready) return null
  return window.tronWeb.defaultAddress?.base58 ?? null
}

/**
 * Tron 지갑 어댑터 훅
 * @returns {{
 *   type: 'tron',
 *   address: string|null,
 *   isConnected: boolean,
 *   isConnecting: boolean,
 *   connect: () => Promise<void>,
 *   disconnect: () => void,
 *   connectorName: string|null,
 *   chainId: null,
 *   chain: null,
 *   isInstalled: boolean,
 * }}
 */
export function useTronAdapter() {
  const [address, setAddress] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const retryRef = useRef(0)
  const intervalRef = useRef(null)

  // ── TronLink 감지 함수 ──────────────────────────────────────────
  const checkTronLink = useCallback(() => {
    const installed = detectTronLink()
    setIsInstalled(installed)
    if (installed) {
      const addr = getTronAddress()
      setAddress(addr)
      // 감지 성공 → 인터벌 정리
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  // ── 초기 감지 + 재시도 로직 ─────────────────────────────────────
  useEffect(() => {
    // 즉시 한 번 체크
    checkTronLink()

    // 아직 미감지 → 재시도 인터벌 시작
    if (!detectTronLink()) {
      retryRef.current = 0
      intervalRef.current = setInterval(() => {
        retryRef.current += 1
        checkTronLink()
        if (retryRef.current >= MAX_RETRIES || detectTronLink()) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }, RETRY_INTERVAL)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [checkTronLink])

  // ── focus / visibilitychange 재감지 ─────────────────────────────
  useEffect(() => {
    const handleFocus = () => checkTronLink()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkTronLink()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [checkTronLink])

  // ── TronLink 이벤트 리스너 (주소 변경 감지) ──────────────────────
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.message?.action === 'setAccount') {
        const addr = e.data.message.data?.address ?? null
        setAddress(addr)
      }
      if (e.data?.message?.action === 'setNode') {
        // 노드 변경 시 재감지
        checkTronLink()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [checkTronLink])

  // ── connect ─────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!window.tronLink) return
    setIsConnecting(true)
    try {
      const res = await window.tronLink.request({ method: 'tron_requestAccounts' })
      if (res?.code === 200) {
        // 연결 성공 후 약간의 지연 후 주소 재확인
        setTimeout(() => {
          const addr = getTronAddress()
          setAddress(addr)
          setIsConnecting(false)
        }, 300)
      } else {
        setIsConnecting(false)
      }
    } catch {
      setIsConnecting(false)
    }
  }, [])

  // ── disconnect (TronLink은 실제 disconnect API가 없음, 로컬 상태만 초기화) ──
  const disconnect = useCallback(() => {
    setAddress(null)
  }, [])

  return {
    type: 'tron',
    address,
    isConnected: !!address,
    isConnecting,
    connect,
    disconnect,
    connectorName: isInstalled ? 'TronLink' : null,
    chainId: null,
    chain: null,
    isInstalled,
  }
}
