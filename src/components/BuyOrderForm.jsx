import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { createBuyOrder } from '../types/order'
import { signOrder } from '../lib/signature'

/**
 * BuyOrderForm — Buyer creates and signs a buy order.
 * Wireframe: S15 구매 오더 작성
 */
export default function BuyOrderForm({ onCreated }) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [amount, setAmount]       = useState('')
  const [priceKRW, setPriceKRW]   = useState('1420')
  const [expiryMin, setExpiryMin] = useState('1440') // 24시간
  const [signing, setSigning]     = useState(false)
  const [error, setError]         = useState('')

  const amountNum = parseFloat(amount) || 0
  const priceNum  = parseInt(priceKRW, 10) || 0
  const totalKRW  = Math.round(amountNum * priceNum)
  const feeUsdt   = amountNum > 0 ? Math.round(amountNum * 0.02 * 100) / 100 : 0

  function formatKRW(n) {
    return new Intl.NumberFormat('ko-KR').format(n)
  }

  function setQuickAmount(val) {
    setAmount(String(val))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

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
      const order = createBuyOrder({
        buyer: address,
        amount: amountNum,
        priceKRW: priceNum,
        expiryMs: parseInt(expiryMin, 10) * 60 * 1000,
      })

      const provider = new BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()
      const signed = await signOrder(signer, order)

      onCreated(signed)
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
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
      {/* Info banner */}
      <div className="banner banner-blue" style={{ marginBottom: 14 }}>
        <span className="banner-icon">💡</span>
        <div className="banner-body">
          <div className="banner-title">구매 오더란?</div>
          <div className="banner-text">"나 이 가격에 USDT 사고 싶어요"를 공개 게시. 판매자가 수락하면 에스크로 락 후 거래 시작.</div>
        </div>
      </div>

      {/* Amount input */}
      <div className="form-label-upper">구매 수량</div>
      <div className="ibox">
        <input
          type="number"
          className="ibox-input"
          step="any"
          min="0"
          placeholder="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <span className="ibox-unit">USDT</span>
      </div>

      {/* Quick amount buttons */}
      <div style={{ display: 'flex', gap: 5, marginTop: -4, marginBottom: 13 }}>
        {[50, 100, 200, 500].map(val => (
          <button
            key={val}
            type="button"
            className={`btn btn-sm ${String(val) === amount ? 'btn-blue-solid' : 'btn-ghost'}`}
            style={{ flex: 1, padding: 7 }}
            onClick={() => setQuickAmount(val)}
          >
            {val}
          </button>
        ))}
      </div>

      {/* Price input */}
      <div className="form-label-upper">원화 가격 (KRW/USDT)</div>
      <div className="ibox">
        <input
          type="number"
          className="ibox-input"
          min="0"
          placeholder="1420"
          value={priceKRW}
          onChange={e => setPriceKRW(e.target.value)}
        />
        <span className="ibox-unit">원</span>
      </div>

      {/* Summary box */}
      {amountNum > 0 && priceNum > 0 && (
        <div style={{
          background: 'var(--ink4)', borderRadius: 12, padding: 13, marginBottom: 13,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
            <span style={{ color: 'var(--snow3)' }}>총 지급 예상</span>
            <span style={{ fontWeight: 800, fontSize: 17 }}>{formatKRW(totalKRW)}원</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--snow3)' }}>수수료 2%</span>
            <span style={{ color: 'var(--red)' }}>−{feeUsdt} USDT</span>
          </div>
        </div>
      )}

      {/* Seller account info */}
      <div className="form-label-upper">입금받을 판매자 계좌</div>
      <div style={{
        background: 'var(--grn-d)', border: '1px solid var(--grn-b)', borderRadius: 12,
        padding: '11px 14px', marginBottom: 13, fontSize: 12, color: '#7dffc0',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>ℹ️</span>판매자 수락 시 계좌가 공개됩니다
      </div>

      {/* Expiry button group */}
      <div className="form-label-upper">오더 유효 시간</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
        <button
          type="button"
          className={`btn btn-sm ${expiryMin === '360' ? 'btn-blue-solid' : 'btn-ghost'}`}
          style={{ flex: 1, padding: 9 }}
          onClick={() => setExpiryMin('360')}
        >
          6시간
        </button>
        <button
          type="button"
          className={`btn btn-sm ${expiryMin === '1440' ? 'btn-blue-solid' : 'btn-ghost'}`}
          style={{ flex: 1, padding: 9 }}
          onClick={() => setExpiryMin('1440')}
        >
          24시간
        </button>
        <button
          type="button"
          className={`btn btn-sm ${expiryMin === '4320' ? 'btn-blue-solid' : 'btn-ghost'}`}
          style={{ flex: 1, padding: 9 }}
          onClick={() => setExpiryMin('4320')}
        >
          72시간
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 11 }}>{error}</div>}

      {/* Submit */}
      <button
        className="btn btn-blue"
        type="submit"
        disabled={signing}
      >
        {signing ? '서명 중…' : '구매 오더 올리기 →'}
      </button>
      <div style={{ fontSize: 11, color: 'var(--snow3)', textAlign: 'center', padding: '5px 0' }}>
        판매자 매칭 후 알림이 옵니다 · Gas 없음
      </div>
    </form>
  )
}
