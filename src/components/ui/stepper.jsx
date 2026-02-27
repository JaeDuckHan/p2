/**
 * Stepper — 단계 표시기 컴포넌트
 * 수평 스텝 인디케이터로 완료(초록 체크)/진행중(파란 링)/대기(회색) 상태를 표시합니다.
 * 각 단계 사이에 연결선(커넥터)이 표시되며, 완료된 단계는 초록으로 채워집니다.
 *
 * @param {Array<string>} steps   - 단계 레이블 배열 (HTML 문자열 허용, dangerouslySetInnerHTML 사용)
 * @param {number}        current - 현재 진행 중인 단계 인덱스 (0부터 시작)
 * @param {string}        [className]
 */

import { cn } from '@/lib/utils'
function Stepper({ steps, current = 0, className }) {
  return (
    <div className={cn('flex items-center gap-0', className)}>
      {steps.map((label, i) => {
        const isDone = i < current
        const isActive = i === current
        const isLast = i === steps.length - 1

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            {/* Circle + Label */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isDone && 'bg-success text-white',
                  isActive && 'bg-primary-600 text-white ring-2 ring-primary-200',
                  !isDone && !isActive && 'bg-slate-100 text-slate-400'
                )}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] leading-tight text-center max-w-[60px]',
                  isDone && 'text-success-dark font-medium',
                  isActive && 'text-primary-700 font-semibold',
                  !isDone && !isActive && 'text-slate-400'
                )}
                dangerouslySetInnerHTML={{ __html: label }}
              />
            </div>
            {/* Connector */}
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-1.5 mt-[-18px] rounded-full transition-colors',
                  isDone ? 'bg-success' : 'bg-slate-200'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export { Stepper }
