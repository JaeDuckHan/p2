import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { createBuyOrder } from '../types/order'
import { signOrder } from '../lib/signature'

/**
 * BuyOrderForm — Buyer creates and signs a buy order.
 *
 * @param {Object} props
 * @param {function(import('../types/order').BuyOrder): void} props.onCreated
 */
export default function BuyOrderForm({ onCreated }) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [amount, setAmount]       = useState('')
  const [priceKRW, setPriceKRW]   = useState('')
  const [expiryMin, setExpiryMin] = useState('30')
  const [signing, setSigning]     = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const amountNum = parseFloat(amount)
    const priceNum  = parseInt(priceKRW, 10)

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

  const totalKRW = parseFloat(amount) && parseInt(priceKRW, 10)
    ? Math.round(parseFloat(amount) * parseInt(priceKRW, 10))
    : 0

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="label">USDT 수량</label>
        <input
          className="input"
          type="number"
          step="any"
          min="0"
          placeholder="예: 100"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="label">KRW 환율 (1 USDT 당)</label>
        <input
          className="input"
          type="number"
          min="0"
          placeholder="예: 1380"
          value={priceKRW}
          onChange={e => setPriceKRW(e.target.value)}
        />
        {totalKRW > 0 && (
          <div className="input-hint">
            총 거래 금액: ₩{new Intl.NumberFormat('ko-KR').format(totalKRW)}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="label">유효 기간</label>
        <select
          className="input"
          value={expiryMin}
          onChange={e => setExpiryMin(e.target.value)}
        >
          <option value="15">15분</option>
          <option value="30">30분</option>
          <option value="60">1시간</option>
          <option value="120">2시간</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="fee-box">
        주문 등록은 Gas 비용이 없습니다.
        판매자가 수락하면 <strong>2%</strong> 수수료가 포함된 에스크로가 생성됩니다.
      </div>

      <button
        className="btn btn-blue btn-block btn-lg"
        type="submit"
        disabled={signing}
      >
        {signing ? '서명 중…' : 'MetaMask 서명 후 등록'}
      </button>
    </form>
  )
}
