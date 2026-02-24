import { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { signAcceptRequest } from '../lib/signature'
import { getAvatarGradient, getAvatarChar } from './OrderbookView'
import { getUserRating } from '../lib/mockData'

/**
 * OrderDetail — Shows order info with accept button for buyers.
 */
export default function OrderDetail({ order, onAcceptSent, onCancel, acceptResponse, tradeNotification, onStartTrade }) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  if (!order) return null

  const isSellOrder = order.type === 'SELL'
  const ownerAddr = isSellOrder ? order.seller : order.buyer
  const isOwn = ownerAddr?.toLowerCase() === address?.toLowerCase()
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

  function formatKRW(n) {
    return new Intl.NumberFormat('ko-KR').format(n)
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
      const tradeId = tradeNotification?.tradeId
      return (
        <div className="pad fade-in">
          <div className="banner banner-green">
            <span className="banner-icon">✓</span>
            <div className="banner-body">
              <div className="banner-title">수락 완료</div>
              <div className="banner-text">
                {tradeId ? '거래방에 입장하세요.' : '에스크로 생성을 기다리는 중...'}
              </div>
            </div>
          </div>
          {acceptResponse.bankAccount && (
            <div className="card">
              <div className="card-title">입금 계좌</div>
              <div className="trade-id-box">{acceptResponse.bankAccount}</div>
            </div>
          )}
          {tradeId ? (
            <button
              className="btn btn-teal"
              onClick={() => onStartTrade && onStartTrade(tradeId, 'buyer')}
            >
              거래방 입장
            </button>
          ) : (
            <div className="muted sm" style={{ textAlign: 'center', padding: '1rem' }}>
              판매자가 USDT를 에스크로에 예치하면 자동으로 거래방에 입장합니다...
            </div>
          )}
        </div>
      )
    } else {
      return (
        <div className="pad fade-in">
          <div className="banner banner-amber">
            <span className="banner-icon">😔</span>
            <div className="banner-body">
              <div className="banner-title">수락 거절</div>
              <div className="banner-text">판매자가 다른 구매자를 선택했습니다. 다른 주문을 찾아보세요.</div>
            </div>
          </div>
        </div>
      )
    }
  }

  // ── Order detail view ───────────────────────────────────────────────────

  return (
    <div className="pad fade-in">
      {/* Amount hero */}
      <div style={{ padding: '6px 0 14px', textAlign: 'center' }}>
        <span className={`badge ${isSellOrder ? 'badge-blue' : 'badge-orange'}`} style={{ marginBottom: 8, display: 'inline-flex' }}>
          {isSellOrder ? '📥 구매 플로우 A' : '🤝 판매 플로우 B'}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginTop: 6 }}>
          <span style={{ fontSize: 42, fontWeight: 900, letterSpacing: -2, color: isSellOrder ? 'var(--blue)' : 'var(--orange)' }}>
            {order.amount.toLocaleString()}
          </span>
          <span style={{ fontSize: 20, color: 'var(--snow3)' }}>USDT</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--snow3)', marginTop: 5 }}>
          {formatKRW(totalKRW)}원
        </div>
      </div>

      {/* Seller/Buyer info */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
          <div className="avatar avatar-lg" style={{
            background: getAvatarGradient(ownerAddr),
            color: 'var(--ink)',
          }}>
            {getAvatarChar(ownerAddr)}
          </div>
          <div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{shortAddr(ownerAddr)}</div>
            {/* TODO: 실제 온체인 API 연동 필요 — 평판 데이터 연동 시 realData 전달 */}
            {(() => { const r = getUserRating(ownerAddr); return (
              <div className="stars" style={{ fontSize: 12 }}>{r.stars} <span className="stars-info" style={{ fontSize: 11 }}>{r.score.toFixed(1)}{r.tradeCount > 0 ? ` · ${r.tradeCount}회` : ''}</span></div>
            ) })()}
          </div>
        </div>
        <div className="divider" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
          <span className="muted">{isSellOrder ? '구매 수량' : '판매 수량'}</span>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{order.amount.toLocaleString()} USDT</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
          <span className="muted">환율</span>
          <span style={{ fontWeight: 700 }}>{formatKRW(order.priceKRW)}원/USDT</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
          <span className="muted">유효기간</span>
          <span style={{ fontWeight: 700 }}>{formatExpiry(order.expiry)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span className="muted">총 거래 금액</span>
          <span style={{ fontWeight: 800, color: 'var(--green)' }}>{formatKRW(totalKRW)}원</span>
        </div>
      </div>

      {/* Info banner + 에스크로 안내 */}
      {isSellOrder && !isOwn && (
        <>
          <div className="banner banner-teal">
            <span className="banner-icon">ℹ️</span>
            <div className="banner-body">
              <div className="banner-text">MetaMask 없이 KRW 계좌이체만 하면 됩니다</div>
            </div>
          </div>
          <div className="escrow-info">
            <div className="escrow-info-title">🛡 에스크로 보호 거래</div>
            <div className="escrow-info-item">
              <span className="escrow-info-icon">🔒</span>
              <span>USDT는 스마트 컨트랙트에 안전하게 보관됩니다</span>
            </div>
            <div className="escrow-info-item">
              <span className="escrow-info-icon">⚖️</span>
              <span>분쟁 시 제3자 중재로 공정하게 해결됩니다</span>
            </div>
          </div>
        </>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {isOwn ? (
        <div className="banner banner-blue">
          <span className="banner-icon">📋</span>
          <div className="banner-body">
            <div className="banner-text">내가 등록한 주문입니다. 수락 요청이 오면 알림이 표시됩니다.</div>
          </div>
        </div>
      ) : sent ? (
        <div className="banner banner-green">
          <span className="banner-icon">✓</span>
          <div className="banner-body">
            <div className="banner-title">수락 요청 전송 완료</div>
            <div className="banner-text">판매자의 응답을 기다리세요.</div>
          </div>
        </div>
      ) : isSellOrder ? (
        /* Buyer views a sell order → can accept */
        <>
          <button
            className="btn btn-blue"
            onClick={handleAccept}
            disabled={sending || order.expiry < Date.now()}
            style={{ marginBottom: 7 }}
          >
            {sending ? '서명 중…' : '수락 요청 보내기'}
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>취소</button>
        </>
      ) : (
        /* Seller views a buy order → can accept by depositing */
        <>
          <button
            className="btn btn-orange"
            onClick={() => {
              if (onStartTrade) {
                onStartTrade(null, 'seller', {
                  orderId: order.id,
                  buyerAddress: order.buyer,
                })
              }
            }}
            disabled={order.expiry < Date.now()}
            style={{ marginBottom: 7 }}
          >
            수락 + 에스크로 락 바로 실행
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>취소</button>
        </>
      )}

      <div className="scroll-gap" />
    </div>
  )
}
