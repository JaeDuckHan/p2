/**
 * SellOrderForm.jsx
 *
 * 판매 오더 생성/수정 폼 컴포넌트.
 * 판매자가 USDT 수량, KRW 단가, 은행 계좌, 만료 시간을 입력하고
 * MetaMask 서명을 통해 오더를 생성(또는 수정)한다.
 *
 * 주요 계산:
 *   - totalKRW  = amount × priceKRW          (총 수령 예상 KRW)
 *   - feeUsdt   = amount × 0.02              (수수료 2%, USDT 단위)
 *
 * 서명 흐름:
 *   1. 폼 유효성 검사
 *   2. createSellOrder()로 오더 객체 생성
 *   3. wagmi walletClient → ethers BrowserProvider → signer 취득
 *   4. signOrder()로 EIP-712 서명
 *   5. onCreated(signedOrder) 콜백 호출
 *
 * @param {function} onCreated      - 서명된 오더 객체를 전달받는 콜백
 * @param {Object}  [initialValues] - 수정 모드: 기존 오더 값으로 폼 초기화
 */
import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { createSellOrder } from '../types/order'
import { signOrder } from '../lib/signature'
import { Button } from '@/components/ui/button'
import { InputWithUnit } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'

/**
 * SellOrderForm (기본 내보내기)
 *
 * Seller creates and signs a sell order.
 * Wireframe: S06 판매 오더 작성
 *
 * @param {function} onCreated       - 생성된 오더 콜백
 * @param {Object}  [initialValues]  - 수정 모드: 기존 오더 값으로 폼 초기화
 */
export default function SellOrderForm({ onCreated, initialValues }) {
  const { address } = useAccount()
  // wagmi walletClient: ethers signer 생성에 사용
  const { data: walletClient } = useWalletClient()

  // initialValues가 있으면 수정 모드, 없으면 신규 생성 모드
  const isEditMode = !!initialValues

  // 판매 수량 (USDT, 문자열로 관리하여 소수점 입력 허용)
  const [amount, setAmount]           = useState(initialValues?.amount ? String(initialValues.amount) : '')
  // USDT 1개당 원화 단가 (기본값 1420원)
  const [priceKRW, setPriceKRW]       = useState(initialValues?.priceKRW ? String(initialValues.priceKRW) : '1420')
  // 입금받을 은행 계좌 정보 (구매자 수락 후에만 공개)
  const [bankAccount, setBankAccount] = useState(initialValues?.bankAccount || '')
  // 오더 유효 시간 (분 단위, 기본 24시간 = 1440분)
  const [expiryMin, setExpiryMin]     = useState('1440') // 24시간
  // MetaMask 서명 진행 중 여부 (버튼 비활성화 및 텍스트 변경용)
  const [signing, setSigning]         = useState(false)
  // 유효성 검사 또는 서명 오류 메시지
  const [error, setError]             = useState('')

  // 입력값을 숫자로 변환 (유효하지 않으면 0)
  const amountNum = parseFloat(amount) || 0
  const priceNum  = parseInt(priceKRW, 10) || 0
  // 총 수령 예상 원화 금액 (소수점 반올림)
  const totalKRW  = Math.round(amountNum * priceNum)
  // 수수료 2% (소수점 둘째 자리까지 표시)
  const feeUsdt   = amountNum > 0 ? Math.round(amountNum * 0.02 * 100) / 100 : 0

  /**
   * 원화 금액을 한국 통화 형식으로 포맷한다.
   * 예: 142000 → "142,000"
   */
  function formatKRW(n) {
    return new Intl.NumberFormat('ko-KR').format(n)
  }

  /**
   * 퀵 퍼센트 버튼 클릭 시 preset 수량을 amount 필드에 채운다.
   * 현재는 고정 프리셋 값 사용 (추후 실제 잔액 기반으로 변경 예정)
   */
  function setQuickPercent(pct) {
    // For now, just set some preset amounts
    const presets = { 25: '50', 50: '100', 75: '250', 100: '500' }
    setAmount(presets[pct] || '')
  }

  /**
   * 폼 제출 핸들러.
   * 유효성 검사 → 오더 생성 → MetaMask 서명 → 콜백 호출 순으로 진행한다.
   */
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    // 입력 유효성 검사
    if (!amountNum || amountNum <= 0) {
      setError('USDT 수량을 입력하세요')
      return
    }
    if (!priceNum || priceNum <= 0) {
      setError('KRW 환율을 입력하세요')
      return
    }
    if (!bankAccount.trim()) {
      setError('입금 계좌를 입력하세요')
      return
    }
    if (!walletClient) {
      setError('지갑이 연결되어 있지 않습니다')
      return
    }

    setSigning(true)
    try {
      // 오더 객체 생성 (서명 전 원본 데이터)
      const order = createSellOrder({
        seller: address,
        amount: amountNum,
        priceKRW: priceNum,
        bankAccount: bankAccount.trim(),
        // 분(min) 단위를 밀리초로 변환하여 만료 시간 설정
        expiryMs: parseInt(expiryMin, 10) * 60 * 1000,
      })

      // wagmi walletClient를 ethers BrowserProvider로 래핑하여 signer 취득
      const provider = new BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()
      // EIP-712 구조화 서명 수행
      const signed = await signOrder(signer, order)

      onCreated(signed)
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        // 사용자가 MetaMask에서 서명을 거절한 경우
        setError('서명이 거부되었습니다')
      } else {
        setError(`오류: ${err.message}`)
      }
    } finally {
      setSigning(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* 판매 가능 잔액 카드 (추후 실제 잔액 연동 예정) */}
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
        <div>
          <div className="text-xs font-bold text-amber-500 mb-0.5">판매 가능 잔액</div>
          <div className="text-xl font-black tracking-tight">
            — <span className="text-xs text-slate-400">USDT</span>
          </div>
        </div>
        <div className="text-3xl">🦊</div>
      </div>

      {/* 판매 수량 입력 필드 */}
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">판매 수량</div>
      <InputWithUnit
        type="number"
        step="any"
        min="0"
        placeholder="0"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        unit="USDT"
        className="mb-1.5"
      />

      {/* 퀵 퍼센트 버튼: 잔액 대비 비율로 빠르게 수량 입력 */}
      <div className="flex gap-1.5 mb-3">
        {[
          { label: '25%', pct: 25 },
          { label: '50%', pct: 50 },
          { label: '75%', pct: 75 },
          { label: '최대', pct: 100 },
        ].map(({ label, pct }) => (
          <Button
            key={pct}
            type="button"
            variant={pct === 100 ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setQuickPercent(pct)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* 원화 단가 입력 필드 (KRW/USDT) */}
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">원화 가격 (KRW/USDT)</div>
      <InputWithUnit
        type="number"
        min="0"
        placeholder="1420"
        value={priceKRW}
        onChange={e => setPriceKRW(e.target.value)}
        unit="원"
        className="mb-3"
      />

      {/* 예상 금액 요약 박스: 수량과 단가가 모두 입력된 경우에만 표시 */}
      {amountNum > 0 && priceNum > 0 && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-slate-500">총 수령 예상</span>
            <span className="font-extrabold text-lg">{formatKRW(totalKRW)}원</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">수수료 2%</span>
            {/* 수수료는 USDT에서 차감되므로 음수로 표시 */}
            <span className="text-red-500">−{feeUsdt} USDT</span>
          </div>
        </div>
      )}

      {/* 은행 계좌 입력 필드: 구매자 수락 후 상대방에게만 공개 */}
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">입금받을 계좌</div>
      <InputWithUnit
        type="text"
        placeholder="국민 12345-67-890 홍길동"
        value={bankAccount}
        onChange={e => setBankAccount(e.target.value)}
        className="mb-1 text-xs"
      />
      <div className="text-xs text-slate-400 mb-3">
        구매자가 수락한 후에만 상대방에게 공개됩니다
      </div>

      {/* 오더 유효 시간 선택 버튼 그룹 */}
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">오더 유효 시간</div>
      <div className="flex gap-1.5 mb-4">
        {[
          { label: '6시간',  value: '360' },
          { label: '24시간', value: '1440' },
          { label: '72시간', value: '4320' },
        ].map(({ label, value }) => (
          // 선택된 값은 default 스타일, 나머지는 ghost 스타일
          <Button
            key={value}
            type="button"
            variant={expiryMin === value ? 'default' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setExpiryMin(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* 오류 메시지 표시 */}
      {error && (
        <Alert variant="destructive" className="mb-3">
          {error}
        </Alert>
      )}

      {/* 제출 버튼: 서명 중에는 비활성화 */}
      <Button
        variant="default"
        size="lg"
        className="w-full"
        type="submit"
        disabled={signing}
      >
        {signing ? '서명 중…' : isEditMode ? '수정 오더 올리기 →' : '오더 올리기 →'}
      </Button>
      <div className="text-xs text-slate-400 text-center py-1.5">
        {isEditMode ? '기존 오더는 자동 취소 후 새 오더로 교체됩니다' : '구매자 수락 후 에스크로 락 요청 · Gas 없음'}
      </div>
    </form>
  )
}
