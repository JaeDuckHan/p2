/**
 * EscrowBadge — 에스크로 보호 상태 배지
 *
 * 거래 상태에 따라 에스크로 보호 수준을 시각적으로 표시한다.
 * LOCKED 상태에서는 pulse 애니메이션으로 활성 보호를 강조한다.
 *
 * @param {number}  status  - TradeStatus enum (0-3)
 * @param {boolean} [animate=true] - LOCKED 상태에서 pulse 효과 적용 여부
 */
import { Shield, ShieldCheck, ShieldAlert, Undo2 } from 'lucide-react'
import { TradeStatus } from '../constants'
import { cn } from '@/lib/utils'

const CONFIG = {
  [TradeStatus.LOCKED]: {
    Icon: Shield,
    text: '에스크로 보호 중',
    bg: 'bg-emerald-50 border-emerald-200',
    iconColor: 'text-emerald-600',
    textColor: 'text-emerald-700',
    pulse: true,
  },
  [TradeStatus.RELEASED]: {
    Icon: ShieldCheck,
    text: '거래 완료',
    bg: 'bg-emerald-50 border-emerald-200',
    iconColor: 'text-emerald-600',
    textColor: 'text-emerald-700',
    pulse: false,
  },
  [TradeStatus.REFUNDED]: {
    Icon: Undo2,
    text: '환불 완료',
    bg: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-700',
    pulse: false,
  },
  [TradeStatus.DISPUTED]: {
    Icon: ShieldAlert,
    text: '분쟁 검토 중',
    bg: 'bg-red-50 border-red-200',
    iconColor: 'text-red-600',
    textColor: 'text-red-700',
    pulse: false,
  },
}

export default function EscrowBadge({ status, animate = true }) {
  const config = CONFIG[status]
  if (!config) return null

  const { Icon, text, bg, iconColor, textColor, pulse } = config
  const shouldPulse = pulse && animate

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-colors',
        bg,
        textColor,
      )}
    >
      <Icon
        className={cn('w-3.5 h-3.5', iconColor, shouldPulse && 'animate-pulse')}
        strokeWidth={2.5}
      />
      {text}
    </span>
  )
}
