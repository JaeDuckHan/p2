/**
 * TradeTimeline — 5단계 거래 진행 타임라인
 *
 * useTradeStateMachine의 stepIndex/state를 받아
 * 에스크로 생성 → USDT 잠금 → KRW 송금 → 입금 확인 → 거래 완료
 * 5단계를 시각적으로 표시한다.
 *
 * 기존 Stepper(4단계)를 대체하는 거래 전용 컴포넌트.
 * 각 단계에 lucide 아이콘을 사용하고, DISPUTED/REFUNDED 분기 시
 * 색상을 자동으로 변경한다.
 *
 * @param {number} stepIndex - 현재 진행 단계 (0-4)
 * @param {string} state     - TradeState enum 값 (색상 분기용)
 */
import { Lock, ShieldCheck, ArrowLeftRight, SearchCheck, CheckCheck } from 'lucide-react'
import { TradeState } from '../hooks/useTradeStateMachine'
import { cn } from '@/lib/utils'

const STEPS = [
  { label: '에스크로\n생성',   Icon: Lock },
  { label: 'USDT\n잠금',      Icon: ShieldCheck },
  { label: 'KRW\n송금',       Icon: ArrowLeftRight },
  { label: '입금\n확인',       Icon: SearchCheck },
  { label: '거래\n완료',       Icon: CheckCheck },
]

export default function TradeTimeline({ stepIndex = 0, state }) {
  const isDisputed = state === TradeState.DISPUTED
  const isRefunded = state === TradeState.REFUNDED

  return (
    <div className="flex items-start gap-0">
      {STEPS.map(({ label, Icon }, i) => {
        const isDone = i < stepIndex
        const isActive = i === stepIndex
        const isLast = i === STEPS.length - 1

        // 분쟁 상태에서 활성 단계: 빨간 계열
        const disputeActive = isDisputed && isActive
        // 환불 완료에서 마지막 단계: 파란 계열
        const refundDone = isRefunded && i === stepIndex

        /** 원형 아이콘 배경 색상 */
        const circleClass = cn(
          'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
          isDone && 'bg-success text-white',
          isActive && !disputeActive && !refundDone && 'bg-primary-600 text-white ring-2 ring-primary-200 animate-pulse',
          disputeActive && 'bg-red-500 text-white ring-2 ring-red-200 animate-pulse',
          refundDone && 'bg-blue-500 text-white ring-2 ring-blue-200',
          !isDone && !isActive && 'bg-slate-100 text-slate-400',
        )

        /** 레이블 텍스트 색상 */
        const labelClass = cn(
          'text-[10px] leading-tight text-center whitespace-pre-line max-w-[52px] mt-1.5',
          isDone && 'text-success-dark font-medium',
          isActive && !disputeActive && !refundDone && 'text-primary-700 font-semibold',
          disputeActive && 'text-red-600 font-semibold',
          refundDone && 'text-blue-600 font-semibold',
          !isDone && !isActive && 'text-slate-400',
        )

        /** 커넥터 라인 색상 */
        const connectorClass = cn(
          'flex-1 h-0.5 mx-1 mt-4 rounded-full transition-colors duration-300',
          isDone ? 'bg-success' : 'bg-slate-200',
        )

        return (
          <div key={i} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={circleClass}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 2} />
                )}
              </div>
              <span className={labelClass}>{label}</span>
            </div>
            {!isLast && <div className={connectorClass} />}
          </div>
        )
      })}
    </div>
  )
}
