/**
 * BuyOrderForm.jsx
 *
 * 구매 오더 생성/수정 폼 컴포넌트.
 * 구매자가 USDT 수량, KRW 단가, 만료 시간을 입력하고
 * MetaMask 서명을 통해 구매 오더를 생성(또는 수정)한다.
 *
 * 주요 계산:
 *   - totalKRW  = amount × priceKRW          (총 지급 예상 KRW)
 *   - feeUsdt   = amount × 0.02              (수수료 2%, USDT 단위)
 *
 * 서명 흐름:
 *   1. 폼 유효성 검사
 *   2. createBuyOrder()로 오더 객체 생성
 *   3. wagmi walletClient → ethers BrowserProvider → signer 취득
 *   4. signOrder()로 EIP-712 서명
 *   5. onCreated(signedOrder) 콜백 호출
 *
 * 은행 계좌 정보:
 *   구매 오더에는 판매자 계좌가 없으며, 판매자가 수락 후 계좌를 공개한다.
 *
 * @param {function} onCreated      - 서명된 오더 객체를 전달받는 콜백
 * @param {Object}  [initialValues] - 수정 모드: 기존 오더 값으로 폼 초기화
 */
import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { createBuyOrder } from '../types/order'
import { signOrder } from '../lib/signature'
import { Button } from '@/components/ui/button'
import { InputWithUnit } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { Banner } from '@/components/ui/banner'

/**
 * BuyOrderForm (기본 내보내기)
 *
 * Buyer creates and signs a buy order.
 * Wireframe: S15 구매 오더 작성
 *
 * @param {function} onCreated       - 생성된 오더 콜백
 * @param {Object}  [initialValues]  - 수정 모드: 기존 오더 값으로 폼 초기화
 */
export default function BuyOrderForm({ onCreated, initialValues }) {
  const { address } = useAccount()
  // wagmi walletClient: ethers signer 생성에 사용
  const { data: walletClient } = useWalletClient()

  // initialValues가 있으면 수정 모드, 없으면 신규 생성 모드
  const isEditMode = !!initialValues

  // 구매 수량 (USDT, 문자열로 관리하여 소수점 입력 허용)
  const [amount, setAmount]       = useState(initialValues?.amount ? String(initialValues.amount) : '')
  // USDT 1개당 원화 단가 (기본값 1420원)
  const [priceKRW, setPriceKRW]   = useState(initialValues?.priceKRW ? String(initialValues.priceKRW) : '1420')
  // 오더 유효 시간 (분 단위, 기본 24시간 = 1440분)
  const [expiryMin, setExpiryMin] = useState('1440') // 24시간
  // MetaMask 서명 진행 중 여부 (버튼 비활성화 및 텍스트 변경용)
  const [signing, setSigning]     = useState(false)
  // 유효성 검사 또는 서명 오류 메시지
  const [error, setError]         = useState('')

  // 입력값을 숫자로 변환 (유효하지 않으면 0)
  const amountNum = parseFloat(amount) || 0
  const priceNum  = parseInt(priceKRW, 10) || 0
  // 총 지급 예상 원화 금액 (소수점 반올림)
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
   * 퀵 금액 버튼 클릭 시 해당 USDT 수량을 amount 필드에 채운다.
   * @param {number} val - 설정할 USDT 수량
   */
  function setQuickAmount(val) {
    setAmount(String(val))
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
    if (!walletClient) {
      setError('지갑이 연결되어 있지 않습니다')
      return
    }

    setSigning(true)
    try {
      // 구매 오더 객체 생성 (서명 전 원본 데이터)
      const order = createBuyOrder({
        buyer: address,
        amount: amountNum,
        priceKRW: priceNum,
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
      {/* 구매 오더 개념 설명 배너 */}
      <Banner
        variant="info"
        icon="💡"
        title="구매 오더란?"
        className="mb-3.5"
      >
        "나 이 가격에 USDT 사고 싶어요"를 공개 게시. 판매자가 수락하면 에스크로 락 후 거래 시작.
      </Banner>

      {/* 구매 수량 입력 필드 */}
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">구매 수량</div>
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

      {/* 퀵 금액 버튼: 자주 사용하는 USDT 수량을 빠르게 입력 */}
      <div className="flex gap-1.5 mb-3">
        {[50, 100, 200, 500].map(val => (
          <Button
            key={val}
            type="button"
            // 현재 입력값과 일치하는 버튼은 info 스타일로 강조
            variant={String(val) === amount ? 'info' : 'ghost'}
            size="sm"
            className="flex-1"
            onClick={() => setQuickAmount(val)}
          >
            {val}
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
            <span className="text-slate-500">총 지급 예상</span>
            <span className="font-extrabold text-lg">{formatKRW(totalKRW)}원</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">수수료 2%</span>
            {/* 수수료는 USDT에서 차감되므로 음수로 표시 */}
            <span className="text-red-500">−{feeUsdt} USDT</span>
          </div>
        </div>
      )}

      {/* 판매자 계좌 안내: 구매 오더에는 계좌 입력 없음, 판매자 수락 시 공개 */}
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">입금받을 판매자 계좌</div>
      <Banner variant="info" icon="ℹ️" className="mb-3">
        판매자 수락 시 계좌가 공개됩니다
      </Banner>

      {/* 오더 유효 시간 선택 버튼 그룹 */}
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">오더 유효 시간</div>
      <div className="flex gap-1.5 mb-4">
        {[
          { label: '6시간',  value: '360' },
          { label: '24시간', value: '1440' },
          { label: '72시간', value: '4320' },
        ].map(({ label, value }) => (
          // 선택된 값은 info 스타일, 나머지는 ghost 스타일
          <Button
            key={value}
            type="button"
            variant={expiryMin === value ? 'info' : 'ghost'}
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
        variant="info"
        size="lg"
        className="w-full"
        type="submit"
        disabled={signing}
      >
        {signing ? '서명 중…' : isEditMode ? '수정 오더 올리기 →' : '구매 오더 올리기 →'}
      </Button>
      <div className="text-xs text-slate-400 text-center py-1.5">
        {isEditMode ? '기존 오더는 자동 취소 후 새 오더로 교체됩니다' : '판매자 매칭 후 알림이 옵니다 · Gas 없음'}
      </div>
    </form>
  )
}
