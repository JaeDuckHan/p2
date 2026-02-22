import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { signAcceptRequest } from '../lib/signature'

/**
 * OrderDetail — Shows order info with accept button for buyers.
 *
 * @param {Object} props
 * @param {import('../types/order').Order} props.order
 * @param {function(): void} props.onAcceptSent - Called after buyer sends accept request
 * @param {import('../types/order').AcceptResponse|undefined} props.acceptResponse
 * @param {function(string, string, Object): void} props.onStartTrade
 */
export default function OrderDetail({ order, onAcceptSent, acceptResponse, onStartTrade }) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  if (!order) return null

  const isSellOrder = order.type === 'SELL'
  const isOwn = (isSellOrder ? order.seller : order.buyer)?.toLowerCase() === address?.toLowerCase()
  const totalKRW = Math.round(order.amount * order.priceKRW)

  function formatExpiry(expiry) {
    const remaining = expiry - Date.now()
    if (remaining <= 0) return '만료됨'
    const min = Math.floor(remaining / 60000)
    if (min < 60) return `${min}분 남음`
    const hr = Math.floor(min / 60)
    return `${hr}시간 ${min % 60}분 남음`
  }

  function shortAddr(addr) {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  async function handleAccept() {
    if (!walletClient) {
      setError('지갑이 연결되어 있지 않습니다')
      return
    }

    setSending(true)
    setError('')

    try {
      const provider = new BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()
      const signature = await signAcceptRequest(signer, order.id, address)

      // Dispatch accept request via custom event (App.jsx listens and calls orderbook.requestAccept)
      window.dispatchEvent(new CustomEvent('miniswap:accept-req', {
        detail: {
          orderId: order.id,
          buyer: address,
          timestamp: Date.now(),
          signature,
        }
      }))

      setSent(true)
      if (onAcceptSent) onAcceptSent()
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        setError('서명이 거부되었습니다')
      } else {
        setError(`오류: ${err.message}`)
      }
    } finally {
      setSending(false)
    }
  }

  // ── Accept response handling ────────────────────────────────────────────

  if (acceptResponse) {
    if (acceptResponse.accepted) {
      return (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-title">수락 완료</div>
          <div className="alert alert-success">
            판매자가 수락했습니다! 에스크로 거래가 시작됩니다.
          </div>
          {acceptResponse.bankAccount && (
            <div style={{ marginTop: '1rem' }}>
              <div className="label">입금 계좌</div>
              <div className="trade-id-box">{acceptResponse.bankAccount}</div>
            </div>
          )}
          <button
            className="btn btn-green btn-block btn-lg"
            style={{ marginTop: '1rem' }}
            onClick={() => {
              if (onStartTrade) {
                onStartTrade(null, 'buyer', { orderId: order.id })
              }
            }}
          >
            거래방 입장
          </button>
        </div>
      )
    } else {
      return (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-title">수락 거절</div>
          <div className="alert alert-warning">
            판매자가 다른 구매자를 선택했습니다. 다른 주문을 찾아보세요.
          </div>
        </div>
      )
    }
  }

  // ── Order detail view ───────────────────────────────────────────────────

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="card-title">
        {isSellOrder ? '매도 주문 상세' : '매수 주문 상세'}
      </div>

      <div className="info-grid">
        <div className="info-item">
          <div className="label">수량</div>
          <div className="info-value big">{order.amount.toLocaleString()} USDT</div>
        </div>
        <div className="info-item">
          <div className="label">환율</div>
          <div className="info-value">₩{new Intl.NumberFormat('ko-KR').format(order.priceKRW)}/USDT</div>
        </div>
        <div className="info-item">
          <div className="label">총 거래 금액</div>
          <div className="info-value">₩{new Intl.NumberFormat('ko-KR').format(totalKRW)}</div>
        </div>
        <div className="info-item">
          <div className="label">유효 기간</div>
          <div className="info-value">{formatExpiry(order.expiry)}</div>
        </div>
        <div className="info-item">
          <div className="label">{isSellOrder ? '판매자' : '구매자'}</div>
          <div className="info-value mono">
            {shortAddr(isSellOrder ? order.seller : order.buyer)}
          </div>
        </div>
      </div>

      <div className="divider" />

      {error && <div className="alert alert-error">{error}</div>}

      {isOwn ? (
        <div className="alert alert-info">
          내가 등록한 주문입니다. 수락 요청이 오면 알림이 표시됩니다.
        </div>
      ) : sent ? (
        <div className="alert alert-success">
          수락 요청을 보냈습니다. 판매자의 응답을 기다리세요.
        </div>
      ) : isSellOrder ? (
        /* Buyer views a sell order → can accept */
        <button
          className="btn btn-green btn-block btn-lg"
          onClick={handleAccept}
          disabled={sending || order.expiry < Date.now()}
        >
          {sending ? '서명 중…' : '이 주문 수락하기'}
        </button>
      ) : (
        /* Seller views a buy order → can accept by depositing */
        <button
          className="btn btn-green btn-block btn-lg"
          onClick={() => {
            if (onStartTrade) {
              onStartTrade(null, 'seller', {
                orderId: order.id,
                buyerAddress: order.buyer,
              })
            }
          }}
          disabled={order.expiry < Date.now()}
        >
          이 매수 주문 수락 (에스크로 예치)
        </button>
      )}
    </div>
  )
}
