/**
 * useTradeStateMachine — 거래 UX 상태 머신 훅
 *
 * 온체인 TradeStatus(LOCKED/RELEASED/DISPUTED/REFUNDED)를
 * 더 세분화된 UX 상태로 매핑한다.
 *
 * LOCKED 상태 내부에서 XMTP 시그널 메시지를 분석하여
 * KRW 송금 대기 / 송금 완료 / 입금 확인 중 서브스텝을 구분한다.
 *
 * @param {object} params
 * @param {number|undefined} params.status   - TradeStatus enum (0-3)
 * @param {object|null}      params.trade    - 온체인 Trade 구조체
 * @param {Array}            params.messages - XMTP 메시지 배열
 * @param {'seller'|'buyer'} params.role     - 현재 사용자 역할
 *
 * @returns {{ state, stepIndex, label, guidance, badgeVariant }}
 */
import { useMemo } from 'react'
import { TradeStatus } from '../constants'

/** UX 상태 문자열 enum */
export const TradeState = {
  AWAITING_ESCROW: 'AWAITING_ESCROW',
  ESCROW_LOCKED:   'ESCROW_LOCKED',
  KRW_SENT:        'KRW_SENT',
  CONFIRMING:      'CONFIRMING',
  COMPLETED:       'COMPLETED',
  REFUNDED:        'REFUNDED',
  DISPUTED:        'DISPUTED',
}

/** 각 UX 상태의 메타데이터 */
const STATE_META = {
  [TradeState.AWAITING_ESCROW]: {
    stepIndex: 0,
    label: '에스크로 생성',
    badgeVariant: 'secondary',
    guidance: { seller: null, buyer: null },
  },
  [TradeState.ESCROW_LOCKED]: {
    stepIndex: 1,
    label: 'KRW 송금 대기',
    badgeVariant: 'warning',
    guidance: {
      seller: '구매자가 KRW를 보내는 중입니다. 계좌를 확인하세요.',
      buyer: '판매자의 계좌로 KRW를 송금해주세요.',
    },
  },
  [TradeState.KRW_SENT]: {
    stepIndex: 2,
    label: 'KRW 송금 완료',
    badgeVariant: 'warning',
    guidance: {
      seller: '입금을 확인하고 USDT를 릴리즈하세요.',
      buyer: '판매자가 입금을 확인 중입니다.',
    },
  },
  [TradeState.CONFIRMING]: {
    stepIndex: 3,
    label: '입금 확인 중',
    badgeVariant: 'default',
    guidance: {
      seller: '입금 확인 후 릴리즈 버튼을 눌러주세요.',
      buyer: '판매자가 입금을 확인하고 있습니다.',
    },
  },
  [TradeState.COMPLETED]: {
    stepIndex: 4,
    label: '거래 완료',
    badgeVariant: 'success',
    guidance: { seller: null, buyer: null },
  },
  [TradeState.REFUNDED]: {
    stepIndex: 4,
    label: '환불 완료',
    badgeVariant: 'info',
    guidance: { seller: null, buyer: null },
  },
  [TradeState.DISPUTED]: {
    stepIndex: 2,
    label: '분쟁 중',
    badgeVariant: 'destructive',
    guidance: {
      seller: '운영자가 검토 중입니다. 최대 30일 소요됩니다.',
      buyer: '운영자가 검토 중입니다. 최대 30일 소요됩니다.',
    },
  },
}

/**
 * 채팅 메시지에서 구매자의 KRW 송금 시그널 존재 여부를 판별한다.
 * TradeRoom의 기존 로직(L440-445)을 그대로 이식.
 */
function hasBuyerSignal(messages, role) {
  return messages.some(m => m.type === 'signal' && !m.fromMe && role === 'seller')
    || messages.some(m => m.type === 'signal' && m.fromMe && role === 'buyer')
}

/**
 * 채팅 메시지에서 판매자의 확인 시그널 존재 여부를 판별한다.
 */
function hasSellerConfirmSignal(messages, role) {
  return messages.some(m => m.type === 'signal' && m.fromMe && role === 'seller')
    || messages.some(m => m.type === 'signal' && !m.fromMe && role === 'buyer')
}

/**
 * 온체인 상태 + 시그널 메시지를 분석하여 UX 상태를 결정한다.
 */
function resolveState({ status, trade, messages, role }) {
  if (!trade) return TradeState.AWAITING_ESCROW

  switch (status) {
    case TradeStatus.RELEASED:
      return TradeState.COMPLETED
    case TradeStatus.REFUNDED:
      return TradeState.REFUNDED
    case TradeStatus.DISPUTED:
      return TradeState.DISPUTED
    case TradeStatus.LOCKED: {
      const buyerSent = hasBuyerSignal(messages, role)
      const sellerConfirmed = hasSellerConfirmSignal(messages, role)
      if (sellerConfirmed && buyerSent) return TradeState.CONFIRMING
      if (buyerSent) return TradeState.KRW_SENT
      return TradeState.ESCROW_LOCKED
    }
    default:
      return TradeState.AWAITING_ESCROW
  }
}

export function useTradeStateMachine({ status, trade, messages = [], role }) {
  return useMemo(() => {
    const state = resolveState({ status, trade, messages, role })
    const meta = STATE_META[state]
    return {
      state,
      stepIndex: meta.stepIndex,
      label: meta.label,
      guidance: meta.guidance[role] || null,
      badgeVariant: meta.badgeVariant,
    }
  }, [status, trade, messages, role])
}
