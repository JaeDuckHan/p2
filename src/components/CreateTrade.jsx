/**
 * CreateTrade — 에스크로 거래 생성 컴포넌트 (판매자 전용)
 *
 * 판매자가 구매자 주소와 USDT 금액을 입력하면 아래 2단계를 거쳐 에스크로를 생성합니다.
 *
 * [단계 1] USDT approve: 에스크로 컨트랙트가 판매자의 USDT를 가져갈 수 있도록 허가
 *   - 최초 1회에만 ETH 가스비 필요 (약 0.00005 ETH)
 *   - ETH가 부족하면 Drip 기능으로 0.001 ETH 무료 수령 안내
 *
 * [단계 2] 에스크로 deposit: 가스비 대납 릴레이 방식으로 USDT를 에스크로에 예치
 *   - 판매자는 서명(Permit 혹은 EIP-712)만 하면 가스비 없이 처리됨
 *   - 성공 시 onCreated(tradeId) 콜백 호출
 *
 * 수수료: 거래 금액의 2% (예치 시 자동 계산되어 total = amount + fee)
 */

import { useState, useEffect } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { isAddress, formatEther } from 'viem'
import {
  useCalcTotal,
  useUsdtBalance,
  useUsdtAllowance,
  useApproveUsdt,
  useRelayDeposit,
  useEthBalance,
  useRequestDrip,
  getEscrowAddress,
  formatUsdt,
  parseUsdt,
} from '../hooks/useEscrow'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/banner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Stepper } from '@/components/ui/stepper'
import { Input } from '@/components/ui/input'
import { InputWithUnit } from '@/components/ui/input'
import { useToast } from '@/contexts/ToastContext'

// Arbitrum One 메인넷 체인 ID
const MAINNET_CHAIN_ID = 42161
// approve 트랜잭션에 필요한 최소 ETH 잔액 (0.00005 ETH)
const MIN_ETH_FOR_APPROVE = 50_000_000_000_000n // 0.00005 ETH — approve 가스비

/**
 * CreateTrade 컴포넌트
 *
 * @param {Function} onCreated     - 에스크로 생성 완료 시 호출되는 콜백 (tradeId: string)
 * @param {string}   prefillBuyer  - 구매자 주소 초기값 (오더북에서 수락 시 자동 입력)
 */
export default function CreateTrade({ onCreated, prefillBuyer }) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()

  // 구매자 지갑 주소 입력 상태
  const [buyer,  setBuyer]  = useState(prefillBuyer || '')
  // USDT 판매 금액 입력 상태 (문자열, 소수점 허용)
  const [amount, setAmount] = useState('')

  // prefillBuyer prop이 변경되면 입력 필드에 반영
  useEffect(() => {
    if (prefillBuyer) setBuyer(prefillBuyer)
  }, [prefillBuyer])

  // 입력된 amount 문자열을 USDT 최소 단위(BigInt)로 변환
  const amountBig  = parseUsdt(amount)
  // 수수료(2%) 포함 총 필요 금액 계산
  const { total, fee } = useCalcTotal(amountBig, chainId)
  // 판매자의 현재 USDT 잔액
  const balance    = useUsdtBalance(address, chainId)
  // 에스크로 컨트랙트에 대한 현재 USDT 승인 한도
  const { allowance, refetch: refetchAllowance } = useUsdtAllowance(address, chainId)
  // 현재 체인의 에스크로 컨트랙트 주소
  const escrowAddr = getEscrowAddress(chainId)
  // 판매자의 ETH 잔액 (approve 가스비 충분 여부 확인)
  const ethBalance = useEthBalance()

  // 승인 한도가 총 필요 금액보다 적으면 approve 단계 필요
  const needsApproval = amountBig > 0n && allowance < total
  // ETH 잔액이 approve 가스비보다 적으면 ETH drip 안내
  const needsEth      = needsApproval && ethBalance < MIN_ETH_FOR_APPROVE

  // 현재 진행 단계: 'idle' | 'approving' | 'depositing' | 'done'
  const [step, setStep] = useState('idle')

  // USDT approve 훅
  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approveSuccess, error: approveErr } = useApproveUsdt(chainId)
  // 릴레이 방식 에스크로 deposit 훅
  const { deposit, isPending: depositPending, isConfirming: depositConfirming, isSuccess: depositSuccess, tradeId, error: depositErr, reset: depositReset } = useRelayDeposit(chainId)
  // ETH 무료 드립 요청 훅
  const { requestDrip, isDripping, dripTxHash, dripError } = useRequestDrip()
  const { toast } = useToast()

  // approve 완료 시: 허용 한도를 새로 조회하고 idle 상태로 전환
  useEffect(() => {
    if (approveSuccess && step === 'approving') {
      refetchAllowance()
      setStep('idle')
    }
  }, [approveSuccess, step])

  // deposit 완료 시: 'done' 상태로 전환하고 onCreated 콜백 호출
  useEffect(() => {
    if (depositSuccess && tradeId && step === 'depositing') {
      setStep('done')
      toast('에스크로 예치가 완료되었습니다!', 'success')
      onCreated(tradeId)
    }
  }, [depositSuccess, tradeId, step])

  // 입력 유효성 검사
  const buyerOk  = isAddress(buyer)          // 유효한 이더리움 주소
  const amountOk = amountBig > 0n            // 0보다 큰 금액
  const selfTrade = buyerOk && buyer.toLowerCase() === address?.toLowerCase()  // 본인과의 거래 불가
  const enoughBal = balance >= total         // USDT 잔액 충분 여부

  // approve 버튼 활성화 조건
  const canApprove  = buyerOk && amountOk && !selfTrade && !needsEth && !approvePending && !approveConfirming
  // deposit 버튼 활성화 조건
  const canDeposit  = buyerOk && amountOk && !selfTrade && enoughBal && !needsApproval && !depositPending && !depositConfirming

  const handleApprove = () => { setStep('approving'); approve(total) }
  const handleDeposit = () => { setStep('depositing'); deposit(buyer, amountBig) }

  // approve 또는 deposit 중 발생한 트랜잭션 오류
  const txError = approveErr || depositErr
  // 트랜잭션 처리 중 여부 (버튼 비활성화에 사용)
  const isWorking = approvePending || approveConfirming || depositPending || depositConfirming

  // 지원하지 않는 네트워크인 경우 전환 안내 화면 표시
  if (!escrowAddr) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="w-[76px] h-[76px] rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-4xl mx-auto">
          ⚠️
        </div>
        <div>
          <div className="text-xl font-black text-slate-900 mb-2">잘못된 네트워크</div>
          <div className="text-sm text-slate-500 leading-relaxed mb-6">
            <strong className="text-primary-600">Arbitrum One</strong> 메인넷으로 변경 필요
          </div>
        </div>
        <Button variant="default" onClick={() => switchChain({ chainId: MAINNET_CHAIN_ID })}>
          자동으로 네트워크 전환
        </Button>
      </div>
    )
  }

  // 스텝퍼 현재 단계: approve가 필요하면 0단계(USDT 승인), 완료되면 1단계(에스크로 예치)
  const stepperCurrent = !needsApproval ? 1 : (step === 'approving' ? 0 : 0)

  return (
    <div className="flex flex-col gap-4">
      {/* 단계 표시기: USDT 승인 → 에스크로 예치 */}
      <Stepper
        steps={['USDT<br/>승인', '에스크로<br/>예치']}
        current={stepperCurrent}
        className="pb-1"
      />

      {/* 구매자 지갑 주소 입력 */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          구매자 지갑 주소
        </div>
        <Input
          className="font-mono text-xs"
          placeholder="0x..."
          value={buyer}
          onChange={e => setBuyer(e.target.value.trim())}
        />
        {buyer && !buyerOk && (
          <p className="text-[10px] text-red-500 mt-1">올바른 이더리움 주소를 입력하세요</p>
        )}
        {selfTrade && (
          <p className="text-[10px] text-red-500 mt-1">본인 주소는 구매자로 지정할 수 없습니다</p>
        )}
      </div>

      {/* USDT 판매 금액 입력 */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
          판매 금액
          <span className="text-slate-500 font-normal normal-case ml-2">
            잔액: {formatUsdt(balance)} USDT
          </span>
        </div>
        <InputWithUnit
          type="number"
          min="0"
          step="any"
          placeholder="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          unit="USDT"
        />
      </div>

      {/* 수수료 요약: 거래 금액, 수수료(2%), 총 필요 금액 표시 */}
      {amountBig > 0n && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-slate-500">거래 금액</span>
            <span className="font-extrabold text-slate-900">{formatUsdt(amountBig)} USDT</span>
          </div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500">
              수수료 (2%){' '}
              <span className="text-[9px] text-emerald-600">CEX 대비 ~80% 저렴</span>
            </span>
            <span className="text-red-500">−{formatUsdt(fee)} USDT</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">총 필요 금액</span>
            <span className="font-extrabold text-slate-900">{formatUsdt(total)} USDT</span>
          </div>
          {!enoughBal && amountBig > 0n && (
            <p className="text-red-500 font-bold text-xs mt-2">
              ⚠ USDT 잔액 부족 ({formatUsdt(balance)} USDT)
            </p>
          )}
        </div>
      )}

      {/* ETH drip 안내 배너: ETH 잔액 부족 시 무료 드립 요청 버튼 표시 */}
      {needsEth && (
        <Banner variant="warning" icon="⚠️">
          <div className="mb-1.5">
            <strong>최초 1회 ETH 필요</strong> — USDT 승인 가스비<br />
            <span className="text-xs text-slate-500">
              현재 잔액: {formatEther(ethBalance).slice(0, 8)} ETH
            </span>
          </div>
          {dripTxHash ? (
            <p className="text-xs text-emerald-600">
              ✅ 0.001 ETH 전송 완료! 잠시 후 잔액이 업데이트됩니다.
            </p>
          ) : dripError ? (
            <p className="text-xs text-red-500">
              {dripError.message?.includes('Already has enough ETH')
                ? '이미 ETH가 있습니다. 잠시 후 다시 시도하세요.'
                : dripError.message?.includes('Already dripped')
                ? '이미 ETH를 받으셨습니다. 잠시 기다려주세요.'
                : `오류: ${dripError.message}`}
            </p>
          ) : (
            <Button
              variant="warning"
              size="sm"
              className="mt-1"
              disabled={isDripping}
              onClick={requestDrip}
            >
              {isDripping ? '전송 중...' : '🪂 ETH 받기 (0.001 ETH 무료)'}
            </Button>
          )}
        </Banner>
      )}

      {/* approve 완료 후: 에스크로 예치는 가스비 무료임을 안내 */}
      {!needsApproval && (
        <Banner variant="default" icon="⚡">
          에스크로 예치는 <strong>가스비 무료</strong> — 서명만 하시면 됩니다
        </Banner>
      )}

      {/* 트랜잭션 오류 메시지 */}
      {txError && (
        <Alert variant="destructive">
          <AlertDescription>
            오류: {txError.shortMessage ?? txError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* 액션 버튼: approve 필요 시 승인 버튼, 완료 시 에스크로 락 버튼 표시 */}
      {needsApproval ? (
        <Button
          variant="default"
          size="lg"
          className="w-full"
          disabled={!canApprove || isWorking}
          onClick={handleApprove}
        >
          {approvePending    ? '지갑 승인 대기 중...'     :
           approveConfirming ? '승인 트랜잭션 확인 중...' :
           needsEth          ? '⚠ ETH 먼저 받으세요'     :
           '① USDT 사용 허가 (1회만)'}
        </Button>
      ) : (
        <Button
          variant="success"
          size="lg"
          className="w-full"
          disabled={!canDeposit || isWorking}
          onClick={handleDeposit}
        >
          {depositPending    ? '서명 대기 중...'          :
           depositConfirming ? '예치 트랜잭션 확인 중...' :
           '🔒 에스크로 락 실행 (가스비 무료)'}
        </Button>
      )}
    </div>
  )
}
