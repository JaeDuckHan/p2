/**
 * useTronEscrow.js — Tron 에스크로 훅
 *
 * Tron 네트워크용 에스크로 기능을 제공한다.
 * 현재 escrow 컨트랙트가 배포되지 않았으므로 (deployments.js: escrow=null),
 * 모든 액션은 no-op으로 동작하고 "서비스 준비 중" 상태를 반환한다.
 *
 * 향후 Tron 에스크로 컨트랙트 배포 후 실제 TronWeb 호출로 교체한다.
 */
import { DEPLOYMENTS } from '../deployments'

const TRON_ESCROW = DEPLOYMENTS.tron?.escrow ?? null

/**
 * Tron 에스크로 사용 가능 여부
 * @returns {boolean}
 */
export function isTronEscrowAvailable() {
  return TRON_ESCROW != null
}

/**
 * Tron USDT 잔액 조회 훅
 * escrow 미배포 시 0n 반환
 *
 * @param {string|null} address - Tron 주소 (T...)
 * @returns {bigint}
 */
export function useTronUsdtBalance(address) {
  // TODO: TronWeb triggerConstantContract('balanceOf') 호출
  return 0n
}

/**
 * Tron 에스크로 거래 조회 훅
 * @param {string|null} tradeId
 * @returns {{ trade: null, isLoading: false, isNotFound: true, refetch: () => void }}
 */
export function useTronGetTrade(tradeId) {
  return {
    trade: null,
    isLoading: false,
    isNotFound: true,
    refetch: () => {},
  }
}

/**
 * Tron USDT approve 훅
 * @returns {{ approve: () => void, isPending: false, isConfirming: false, isSuccess: false, error: null }}
 */
export function useTronApproveUsdt() {
  return {
    approve: () => {},
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  }
}

/**
 * Tron 에스크로 deposit 훅
 * @returns {{ deposit: () => void, isPending: false, isConfirming: false, isSuccess: false, tradeId: null, error: null, reset: () => void }}
 */
export function useTronDeposit() {
  return {
    deposit: () => {},
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    tradeId: null,
    error: null,
    reset: () => {},
  }
}

/**
 * Tron 에스크로 release 훅
 * @returns {{ release: () => void, isPending: false, isConfirming: false, isSuccess: false, error: null }}
 */
export function useTronRelease() {
  return {
    release: () => {},
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  }
}

/**
 * Tron 에스크로 refund 훅
 * @returns {{ refund: () => void, isPending: false, isConfirming: false, isSuccess: false, error: null }}
 */
export function useTronRefund() {
  return {
    refund: () => {},
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  }
}

/**
 * Tron 에스크로 dispute 훅
 * @returns {{ dispute: () => void, isPending: false, isConfirming: false, isSuccess: false, error: null }}
 */
export function useTronDispute() {
  return {
    dispute: () => {},
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  }
}
