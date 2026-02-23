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

export default function CreateTrade({ onCreated }) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  const [buyer,  setBuyer]  = useState('')
  const [amount, setAmount] = useState('')

  const amountBig  = parseUsdt(amount)
  const { total, fee } = useCalcTotal(amountBig, chainId)
  const balance    = useUsdtBalance(address, chainId)
  const { allowance, refetch: refetchAllowance } = useUsdtAllowance(address, chainId)
  const escrowAddr = getEscrowAddress(chainId)

  const needsApproval = amountBig > 0n && allowance < total

  // Step: 'idle' | 'approving' | 'depositing' | 'done'
  const [step, setStep] = useState('idle')

  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approveSuccess, error: approveErr } = useApproveUsdt(chainId)
  const { deposit, isPending: depositPending, isConfirming: depositConfirming, isSuccess: depositSuccess, tradeId, error: depositErr } = useDeposit(chainId)

  // After approval confirmed → allow deposit
  useEffect(() => {
    if (approveSuccess && step === 'approving') {
      refetchAllowance()
      setStep('idle')
    }
  }, [approveSuccess, step])

  // After deposit confirmed → call onCreated
  useEffect(() => {
    if (depositSuccess && tradeId && step === 'depositing') {
      setStep('done')
      onCreated(tradeId)
    }
  }, [depositSuccess, tradeId, step])

  // Validation
  const buyerOk  = isAddress(buyer)
  const amountOk = amountBig > 0n
  const selfTrade = buyerOk && buyer.toLowerCase() === address?.toLowerCase()
  const enoughBal = balance >= total

  const canApprove  = buyerOk && amountOk && !selfTrade && !approvePending && !approveConfirming
  const canDeposit  = buyerOk && amountOk && !selfTrade && enoughBal && !needsApproval && !depositPending && !depositConfirming

  const handleApprove = () => {
    setStep('approving')
    approve(total)
  }

  const handleDeposit = () => {
    setStep('depositing')
    deposit(buyer, amountBig)
  }

  const txError = approveErr || depositErr
  const isWorking = approvePending || approveConfirming || depositPending || depositConfirming

  if (!escrowAddr) {
    return (
      <div className="no-contract">
        <h2>네트워크 전환 필요</h2>
        <p>이 앱은 <strong>Arbitrum Sepolia</strong> 테스트넷에서 동작합니다.</p>
        <button className="btn" onClick={() => switchChain({ chainId: 421614 })}>
          Arbitrum Sepolia로 전환
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Buyer address */}
      <div className="form-group">
        <label className="label">구매자 지갑 주소 (Buyer Address)</label>
        <input
          className="input"
          placeholder="0x..."
          value={buyer}
          onChange={e => setBuyer(e.target.value.trim())}
        />
        {buyer && !buyerOk  && <div className="input-error">올바른 이더리움 주소를 입력하세요</div>}
        {selfTrade          && <div className="input-error">본인 주소는 구매자로 지정할 수 없습니다</div>}
      </div>

      {/* USDT amount */}
      <div className="form-group">
        <label className="label">
          판매 금액 (USDT)
          <span className="muted" style={{ marginLeft: '0.5rem', fontWeight: 400 }}>
            잔액: {formatUsdt(balance)} USDT
          </span>
        </label>
        <input
          className="input"
          type="number"
          min="0"
          step="any"
          placeholder="예) 100"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </div>

      {/* Fee summary */}
      {amountBig > 0n && (
        <div className="fee-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span>거래 금액</span>
            <strong>{formatUsdt(amountBig)} USDT</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span>수수료 (2%)</span>
            <strong>{formatUsdt(fee)} USDT</strong>
          </div>
          <div style={{ height: 1, background: '#92400e', margin: '0.4rem 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>총 필요 금액 (approve)</span>
            <strong>{formatUsdt(total)} USDT</strong>
          </div>
          {!enoughBal && amountBig > 0n && (
            <div style={{ color: 'var(--red)', marginTop: '0.4rem', fontWeight: 600 }}>
              ⚠ USDT 잔액 부족 ({formatUsdt(balance)} USDT)
            </div>
          )}
        </div>
      )}

      {/* Steps */}
      <div className="steps">
        <div className="step">
          <div className={`step-num ${!needsApproval ? 'done' : step === 'approving' ? 'active' : ''}`}>
            {!needsApproval ? '✓' : '1'}
          </div>
          <div className="step-body">
            <div className="step-title">USDT 사용 허가 (approve)</div>
            <div className="step-desc">에스크로 컨트랙트가 USDT를 가져갈 수 있도록 허가합니다</div>
          </div>
        </div>
        <div className="step">
          <div className={`step-num ${step === 'depositing' || step === 'done' ? 'active' : ''}`}>2</div>
          <div className="step-body">
            <div className="step-title">USDT 에스크로에 예치 (deposit)</div>
            <div className="step-desc">USDT가 스마트 컨트랙트에 잠기고 거래 ID가 생성됩니다</div>
          </div>
        </div>
      </div>

      {/* Error */}
      {txError && (
        <div className="alert alert-error">
          오류: {txError.shortMessage ?? txError.message}
        </div>
      )}

      {/* Action button */}
      <div className="actions">
        {needsApproval ? (
          <button
            className="btn btn-blue btn-lg btn-block"
            disabled={!canApprove || isWorking}
            onClick={handleApprove}
          >
            {approvePending    ? '지갑 승인 대기 중...'     :
             approveConfirming ? '승인 트랜잭션 확인 중...' :
             '① USDT 사용 허가'}
          </button>
        ) : (
          <button
            className="btn btn-green btn-lg btn-block"
            disabled={!canDeposit || isWorking}
            onClick={handleDeposit}
          >
            {depositPending    ? '지갑 서명 대기 중...'   :
             depositConfirming ? '예치 트랜잭션 확인 중...' :
             '② USDT 에스크로 예치'}
          </button>
        )}
      </div>
    </div>
  )
}
