import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useUsdtBalance, formatUsdt } from '../hooks/useEscrow'

const DISMISSED_KEY = 'miniswap:onboard-dismissed'

/**
 * OnboardBanner — 첫 접속 유저를 위한 단계별 안내 배너.
 * 지갑 연결 → USDT 준비 → 거래 시작 흐름을 시각적으로 안내.
 * 유저가 닫으면 localStorage에 저장하여 다시 표시하지 않음.
 */
export default function OnboardBanner() {
  const { address, isConnected, chainId } = useAccount()
  const balance = useUsdtBalance(address, chainId)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) {
      setDismissed(true)
    }
  }, [])

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  if (dismissed || !isConnected) return null

  // 단계 판단
  const walletDone = isConnected
  const hasFunds = balance > 0n
  // step: 0=지갑연결(완료), 1=USDT준비, 2=거래시작
  const currentStep = hasFunds ? 2 : 1

  return (
    <div className="onboard-banner fade-in">
      <button className="onboard-close" onClick={handleDismiss} title="닫기">&times;</button>
      <div className="onboard-title">시작 가이드</div>
      <div className="onboard-steps">
        {/* Step 1: 지갑 연결 */}
        <div className="onboard-step">
          <div className="onboard-step-icon done">✓</div>
          <div className="onboard-step-label">지갑<br/>연결</div>
        </div>
        <div className="onboard-arrow">→</div>

        {/* Step 2: USDT 준비 */}
        <div className="onboard-step">
          <div className={`onboard-step-icon ${currentStep > 1 ? 'done' : 'current'}`}>
            {currentStep > 1 ? '✓' : '2'}
          </div>
          <div className="onboard-step-label">
            USDT<br/>준비
            {!hasFunds && (
              <span style={{ display: 'block', fontSize: 9, color: 'var(--amber)', marginTop: 2 }}>
                잔액: {formatUsdt(balance)}
              </span>
            )}
          </div>
        </div>
        <div className="onboard-arrow">→</div>

        {/* Step 3: 거래 */}
        <div className="onboard-step">
          <div className={`onboard-step-icon ${currentStep > 2 ? 'done' : currentStep === 2 ? 'current' : 'pending'}`}>
            {currentStep > 2 ? '✓' : '3'}
          </div>
          <div className="onboard-step-label">거래<br/>시작</div>
        </div>
      </div>
    </div>
  )
}
