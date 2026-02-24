import { useState, useEffect } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { isAddress } from 'viem'
import {
  useCalcTotal,
  useUsdtBalance,
  useUsdtAllowance,
  useApproveUsdt,
  useDeposit,
  getEscrowAddress,
  formatUsdt,
  parseUsdt,
} from '../hooks/useEscrow'

/**
 * CreateTrade — Direct escrow deposit (S08 에스크로 락 style)
 */
export default function CreateTrade({ onCreated, prefillBuyer }) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const [buyer,  setBuyer]  = useState(prefillBuyer || '')
  const [amount, setAmount] = useState('')

  // Sync prefillBuyer prop changes
  useEffect(() => {
    if (prefillBuyer) setBuyer(prefillBuyer)
  }, [prefillBuyer])

  const amountBig  = parseUsdt(amount)
  const { total, fee } = useCalcTotal(amountBig, chainId)
  const balance    = useUsdtBalance(address, chainId)
  const { allowance, refetch: refetchAllowance } = useUsdtAllowance(address, chainId)
  const escrowAddr = getEscrowAddress(chainId)

  const needsApproval = amountBig > 0n && allowance < total

  const [step, setStep] = useState('idle')

  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approveSuccess, error: approveErr } = useApproveUsdt(chainId)
  const { deposit, isPending: depositPending, isConfirming: depositConfirming, isSuccess: depositSuccess, tradeId, error: depositErr } = useDeposit(chainId)

  useEffect(() => {
    if (approveSuccess && step === 'approving') {
      refetchAllowance()
      setStep('idle')
    }
  }, [approveSuccess, step])

  useEffect(() => {
    if (depositSuccess && tradeId && step === 'depositing') {
      setStep('done')
      onCreated(tradeId)
    }
  }, [depositSuccess, tradeId, step])

  const buyerOk  = isAddress(buyer)
  const amountOk = amountBig > 0n
  const selfTrade = buyerOk && buyer.toLowerCase() === address?.toLowerCase()
  const enoughBal = balance >= total

  const canApprove  = buyerOk && amountOk && !selfTrade && !approvePending && !approveConfirming
  const canDeposit  = buyerOk && amountOk && !selfTrade && enoughBal && !needsApproval && !depositPending && !depositConfirming

  const handleApprove = () => { setStep('approving'); approve(total) }
  const handleDeposit = () => { setStep('depositing'); deposit(buyer, amountBig) }

  const txError = approveErr || depositErr
  const isWorking = approvePending || approveConfirming || depositPending || depositConfirming

  // Current step for indicator
  const currentStep = needsApproval ? 0 : 1

  if (!escrowAddr) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <div style={{
          width: 76, height: 76, borderRadius: 24,
          background: 'var(--amber-d)', border: '1px solid var(--amber-b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 38, margin: '0 auto 20px',
        }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 7 }}>잘못된 네트워크</div>
        <div style={{ fontSize: 13, color: 'var(--snow3)', lineHeight: 1.8, marginBottom: 24 }}>
          <strong style={{ color: 'var(--teal)' }}>Arbitrum Sepolia</strong> 로 변경 필요
        </div>
        <button className="btn btn-teal" onClick={() => switchChain({ chainId: 421614 })}>
          자동으로 네트워크 전환
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Step indicators */}
      <div className="steps-row" style={{ padding: '0 0 13px' }}>
        <div className="step-item">
          <div className={`step-circle ${!needsApproval ? 'done' : step === 'approving' ? 'active' : 'waiting'}`}>
            {!needsApproval ? '✓' : '1'}
          </div>
          <div className="step-label">USDT<br/>승인</div>
        </div>
        <div className={`step-connector ${!needsApproval ? 'done' : ''}`} />
        <div className="step-item">
          <div className={`step-circle ${step === 'depositing' || step === 'done' ? 'active' : 'waiting'}`}>
            2
          </div>
          <div className="step-label">에스크로<br/>예치</div>
        </div>
      </div>

      {/* Buyer address */}
      <div className="form-label-upper">구매자 지갑 주소</div>
      <div className="ibox" style={{ cursor: 'text' }}>
        <input
          className="ibox-input"
          placeholder="0x..."
          value={buyer}
          onChange={e => setBuyer(e.target.value.trim())}
          style={{ fontSize: 12, fontFamily: 'var(--mono)' }}
        />
      </div>
      {buyer && !buyerOk  && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: -7, marginBottom: 8 }}>올바른 이더리움 주소를 입력하세요</div>}
      {selfTrade          && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: -7, marginBottom: 8 }}>본인 주소는 구매자로 지정할 수 없습니다</div>}

      {/* USDT amount */}
      <div className="form-label-upper">
        판매 금액
        <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>
          잔액: {formatUsdt(balance)} USDT
        </span>
      </div>
      <div className="ibox">
        <input
          className="ibox-input"
          type="number"
          min="0"
          step="any"
          placeholder="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <span className="ibox-unit">USDT</span>
      </div>

      {/* Fee summary */}
      {amountBig > 0n && (
        <div style={{ background: 'var(--ink4)', borderRadius: 12, padding: 13, marginBottom: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
            <span style={{ color: 'var(--snow3)' }}>거래 금액</span>
            <span style={{ fontWeight: 800 }}>{formatUsdt(amountBig)} USDT</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
            <span style={{ color: 'var(--snow3)' }}>수수료 (2%) <span style={{ fontSize: 9, color: 'var(--green)' }}>CEX 대비 ~80% 저렴</span></span>
            <span style={{ color: 'var(--red)' }}>−{formatUsdt(fee)} USDT</span>
          </div>
          <div className="divider" style={{ margin: '7px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--snow3)' }}>총 필요 금액</span>
            <span style={{ fontWeight: 800 }}>{formatUsdt(total)} USDT</span>
          </div>
          {!enoughBal && amountBig > 0n && (
            <div style={{ color: 'var(--red)', marginTop: 7, fontWeight: 700, fontSize: 12 }}>
              ⚠ USDT 잔액 부족 ({formatUsdt(balance)} USDT)
            </div>
          )}
        </div>
      )}

      {/* MetaMask popup notice */}
      <div className="banner banner-amber">
        <span className="banner-icon">⚡</span>
        <div className="banner-body">
          <div className="banner-text">MetaMask 팝업 <strong>2번</strong> — approve → deposit 순서</div>
        </div>
      </div>

      {/* Error */}
      {txError && (
        <div className="alert alert-error">
          오류: {txError.shortMessage ?? txError.message}
        </div>
      )}

      {/* Action button */}
      {needsApproval ? (
        <button
          className="btn btn-teal"
          disabled={!canApprove || isWorking}
          onClick={handleApprove}
        >
          {approvePending    ? '지갑 승인 대기 중...'     :
           approveConfirming ? '승인 트랜잭션 확인 중...' :
           '① USDT 사용 허가'}
        </button>
      ) : (
        <button
          className="btn btn-green"
          disabled={!canDeposit || isWorking}
          onClick={handleDeposit}
        >
          {depositPending    ? '지갑 서명 대기 중...'   :
           depositConfirming ? '예치 트랜잭션 확인 중...' :
           '🔒 에스크로 락 실행'}
        </button>
      )}
    </div>
  )
}
