import { getAvatarGradient, getAvatarChar } from './OrderbookView'
import { getUserRating } from '../lib/mockData'

/**
 * BuyerSelector — Seller picks a buyer from multiple accept requests.
 * Wireframe: S07 구매자 선택
 */
export default function BuyerSelector({ order, requests, onSelect, onReject }) {
  if (!order || !requests || requests.length === 0) {
    return (
      <div className="pad fade-in">
        <div className="banner banner-blue">
          <span className="banner-icon">ℹ️</span>
          <div className="banner-body">
            <div className="banner-text">수락 요청이 없습니다.</div>
          </div>
        </div>
      </div>
    )
  }

  function shortAddr(addr) {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  function formatTime(ts) {
    const d = new Date(ts)
    const now = Date.now()
    const diff = now - ts
    if (diff < 60000) return '방금'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  function formatKRW(n) {
    return new Intl.NumberFormat('ko-KR').format(n)
  }

  const totalKRW = Math.round(order.amount * order.priceKRW)

  return (
    <div className="pad fade-in">
      {/* Notification banner */}
      <div className="banner banner-amber">
        <span className="banner-icon">🔔</span>
        <div className="banner-body">
          <div className="banner-title">{requests.length}명이 구매 요청했습니다</div>
          <div className="banner-text">1명 선택 → 나머지 자동 거절</div>
        </div>
      </div>

      {/* Order summary */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--ink4)', border: '1px solid var(--line2)', borderRadius: 12,
        padding: '11px 14px', marginBottom: 14,
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--snow3)', marginBottom: 2 }}>내 오더</div>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>
            {order.amount.toLocaleString()} USDT{' '}
            <span style={{ fontSize: 12, color: 'var(--teal)' }}>{formatKRW(totalKRW)}원</span>
          </div>
        </div>
        <span className="badge badge-green">오픈</span>
      </div>

      {/* Request count label */}
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--snow3)',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
      }}>
        수락 요청 · {requests.length}건
      </div>

      {/* Request cards */}
      {requests.map((req, idx) => {
        const isFirst = idx === 0
        return (
          <div
            key={`${req.orderId}-${req.buyer}`}
            className={`req-card ${isFirst ? 'highlight' : ''}`}
          >
            <div
              className="avatar avatar-md"
              style={{
                background: getAvatarGradient(req.buyer),
                color: 'var(--ink)',
              }}
            >
              {getAvatarChar(req.buyer)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
                  {shortAddr(req.buyer)}
                </span>
                {isFirst && (
                  <span className="badge badge-green" style={{ fontSize: 9, padding: '2px 6px' }}>추천</span>
                )}
              </div>
              {/* TODO: 실제 온체인 API 연동 필요 — 평판 데이터 연동 시 realData 전달 */}
              {(() => { const r = getUserRating(req.buyer); return (
                <div className="stars" style={{ fontSize: 10 }}>{r.stars} <span className="stars-info">{r.score.toFixed(1)}{r.tradeCount > 0 ? ` · ${r.tradeCount}회` : ''}</span></div>
              ) })()}
              <div style={{ fontSize: 10, color: 'var(--snow3)', marginTop: 1 }}>
                {formatTime(req.timestamp)} · 서명 ✓
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexDirection: 'column' }}>
              <button
                className={`btn btn-sm ${isFirst ? 'btn-green' : 'btn-ghost'}`}
                onClick={(e) => { e.stopPropagation(); onSelect(req.buyer) }}
              >
                선택
              </button>
              <button
                className="btn btn-sm btn-ghost"
                style={{ fontSize: 10, padding: '4px 10px' }}
                onClick={(e) => { e.stopPropagation(); onReject(req.buyer) }}
              >
                거절
              </button>
            </div>
          </div>
        )
      })}

      <div className="scroll-gap" />
    </div>
  )
}
