import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { createSellOrder } from '../types/order'
import { signOrder } from '../lib/signature'

/**
 * SellOrderForm — Seller creates and signs a sell order.
 * Wireframe: S06 판매 오더 작성
 */
export default function SellOrderForm({ onCreated }) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [amount, setAmount]           = useState('')
  const [priceKRW, setPriceKRW]       = useState('1420')
  const [bankAccount, setBankAccount] = useState('')
  const [expiryMin, setExpiryMin]     = useState('1440') // 24시간
  const [signing, setSigning]         = useState(false)
  const [error, setError]             = useState('')

  const amountNum = parseFloat(amount) || 0
  const priceNum  = parseInt(priceKRW, 10) || 0
  const totalKRW  = Math.round(amountNum * priceNum)
  const feeUsdt   = amountNum > 0 ? Math.round(amountNum * 0.02 * 100) / 100 : 0

  function formatKRW(n) {
    return new Intl.NumberFormat('ko-KR').format(n)
  }

  function setQuickPercent(pct) {
    // For now, just set some preset amounts
    const presets = { 25: '50', 50: '100', 75: '250', 100: '500' }
    setAmount(presets[pct] || '')
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
      const order = createSellOrder({
        seller: address,
        amount: amountNum,
        priceKRW: priceNum,
        bankAccount: bankAccount.trim(),
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
      {/* Balance card */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--amber-d)', border: '1px solid var(--amber-b)',
        borderRadius: 12, padding: '11px 14px', marginBottom: 16,
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700, marginBottom: 2 }}>판매 가능 잔액</div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -1 }}>
            — <span style={{ fontSize: 12, color: 'var(--snow3)' }}>USDT</span>
          </div>
        </div>
        <div style={{ fontSize: 30 }}>🦊</div>
      </div>

      {/* Amount input */}
      <div className="form-label-upper">판매 수량</div>
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

      {/* Quick percent buttons */}
      <div style={{ display: 'flex', gap: 5, marginTop: -4, marginBottom: 13 }}>
        <button type="button" className="btn btn-sm btn-ghost" style={{ flex: 1, padding: 7 }} onClick={() => setQuickPercent(25)}>25%</button>
        <button type="button" className="btn btn-sm btn-ghost" style={{ flex: 1, padding: 7 }} onClick={() => setQuickPercent(50)}>50%</button>
        <button type="button" className="btn btn-sm btn-ghost" style={{ flex: 1, padding: 7 }} onClick={() => setQuickPercent(75)}>75%</button>
        <button type="button" className="btn btn-sm btn-teal" style={{ flex: 1, padding: 7 }} onClick={() => setQuickPercent(100)}>최대</button>
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
            <span style={{ color: 'var(--snow3)' }}>총 수령 예상</span>
            <span style={{ fontWeight: 800, fontSize: 17 }}>{formatKRW(totalKRW)}원</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--snow3)' }}>수수료 2%</span>
            <span style={{ color: 'var(--red)' }}>−{feeUsdt} USDT</span>
          </div>
        </div>
      )}

      {/* Bank account */}
      <div className="form-label-upper">입금받을 계좌</div>
      <div className="ibox" style={{ cursor: 'text' }}>
        <input
          type="text"
          className="ibox-input"
          placeholder="국민 12345-67-890 홍길동"
          value={bankAccount}
          onChange={e => setBankAccount(e.target.value)}
          style={{ fontSize: 12 }}
        />
      </div>
      <div style={{ fontSize: 10, color: 'var(--snow3)', marginTop: -7, marginBottom: 13 }}>
        구매자가 수락한 후에만 상대방에게 공개됩니다
      </div>

      {/* Expiry button group */}
      <div className="form-label-upper">오더 유효 시간</div>
      <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
        <button
          type="button"
          className={`btn btn-sm ${expiryMin === '360' ? 'btn-teal' : 'btn-ghost'}`}
          style={{ flex: 1, padding: 9 }}
          onClick={() => setExpiryMin('360')}
        >
          6시간
        </button>
        <button
          type="button"
          className={`btn btn-sm ${expiryMin === '1440' ? 'btn-teal' : 'btn-ghost'}`}
          style={{ flex: 1, padding: 9 }}
          onClick={() => setExpiryMin('1440')}
        >
          24시간
        </button>
        <button
          type="button"
          className={`btn btn-sm ${expiryMin === '4320' ? 'btn-teal' : 'btn-ghost'}`}
          style={{ flex: 1, padding: 9 }}
          onClick={() => setExpiryMin('4320')}
        >
          72시간
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 11 }}>{error}</div>}

      {/* Submit */}
      <button
        className="btn btn-teal"
        type="submit"
        disabled={signing}
      >
        {signing ? '서명 중…' : '오더 올리기 →'}
      </button>
      <div style={{ fontSize: 11, color: 'var(--snow3)', textAlign: 'center', padding: '5px 0' }}>
        구매자 수락 후 에스크로 락 요청 · Gas 없음
      </div>
    </form>
  )
}
