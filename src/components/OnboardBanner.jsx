/**
 * OnboardBanner.jsx
 *
 * 신규 사용자를 위한 온보딩 안내 배너 컴포넌트.
 * 지갑 연결 → USDT 준비 → 거래 시작의 3단계 진행 상황을 시각적으로 안내한다.
 *
 * 표시 조건:
 *   - 지갑이 연결된 상태여야 한다
 *   - 사용자가 닫기(×) 버튼을 누르기 전까지만 표시된다
 *
 * 닫기 상태 저장:
 *   localStorage의 'miniswap:onboard-dismissed' 키에 '1'을 저장하여
 *   페이지를 다시 방문해도 배너가 다시 나타나지 않는다.
 */
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useUsdtBalance, formatUsdt } from '../hooks/useEscrow'
import { Card, CardContent } from '@/components/ui/card'
import { Stepper } from '@/components/ui/stepper'

/** localStorage에서 배너 닫힘 상태를 읽고 쓸 때 사용하는 키 */
const DISMISSED_KEY = 'miniswap:onboard-dismissed'

/**
 * OnboardBanner (기본 내보내기)
 *
 * 첫 접속 유저를 위한 단계별 안내 배너.
 * 지갑 연결 → USDT 준비 → 거래 시작 흐름을 시각적으로 안내.
 * 유저가 닫으면 localStorage에 저장하여 다시 표시하지 않음.
 */
export default function OnboardBanner() {
  const { address, isConnected, chainId } = useAccount()
  // 현재 지갑 주소의 USDT 잔액 (BigInt, 소수점 6자리)
  const balance = useUsdtBalance(address, chainId)
  // 사용자가 배너를 닫았는지 여부 (닫으면 컴포넌트가 null 반환)
  const [dismissed, setDismissed] = useState(false)

  // 마운트 시 localStorage에서 이전에 닫은 기록 확인
  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) {
      setDismissed(true)
    }
  }, [])

  /**
   * 배너 닫기 처리.
   * 상태를 dismissed로 변경하고 localStorage에 기록하여 재방문 시에도 유지.
   */
  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  // 이미 닫았거나 지갑이 연결되지 않은 경우 배너를 표시하지 않음
  if (dismissed || !isConnected) return null

  // 단계 판단
  const walletDone = isConnected
  const hasFunds = balance > 0n
  // step: 0=지갑연결(완료), 1=USDT준비, 2=거래시작
  // USDT 잔액이 있으면 2단계(거래 시작)로, 없으면 1단계(USDT 준비)로 표시
  const currentStep = hasFunds ? 2 : 1

  // 각 단계 레이블 (HTML 태그 포함 가능)
  // USDT 잔액이 0인 경우 현재 잔액을 작은 글씨로 함께 표시
  const steps = [
    '지갑<br/>연결',
    `USDT<br/>준비${!hasFunds ? `<br/><span style="font-size:9px;color:#f59e0b">${formatUsdt(balance)}</span>` : ''}`,
    '거래<br/>시작',
  ]

  return (
    <Card className="relative animate-fade-in bg-white">
      {/* 닫기 버튼: 클릭 시 배너를 영구적으로 숨김 */}
      <button
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-lg leading-none"
        onClick={handleDismiss}
        title="닫기"
      >
        &times;
      </button>
      <CardContent className="pt-4 pb-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          시작 가이드
        </div>
        {/* 단계별 진행 상황 표시: currentStep 기준으로 완료/현재/대기 상태 렌더링 */}
        <Stepper steps={steps} current={currentStep} />
      </CardContent>
    </Card>
  )
}
