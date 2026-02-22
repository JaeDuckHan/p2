/**
 * BuyerSelector — Seller picks a buyer from multiple accept requests.
 *
 * @param {Object} props
 * @param {import('../types/order').SellOrder} props.order
 * @param {import('../types/order').AcceptRequest[]} props.requests
 * @param {function(string): void} props.onSelect  - Called with selected buyer address
 * @param {function(string): void} props.onReject  - Called with rejected buyer address
 */
export default function BuyerSelector({ order, requests, onSelect, onReject }) {
  if (!order || !requests || requests.length === 0) {
    return (
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-title">구매자 선택</div>
        <div className="alert alert-info">수락 요청이 없습니다.</div>
      </div>
    )
  }

  function shortAddr(addr) {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  function formatTime(ts) {
    const d = new Date(ts)
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="card-title">구매자 선택</div>

      <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
        {requests.length}명의 구매자가 수락을 요청했습니다.
        1명을 선택하면 나머지에게 거절 메시지가 자동 전송됩니다.
      </div>

      <div className="info-grid" style={{ marginBottom: '1rem' }}>
        <div className="info-item">
          <div className="label">주문 수량</div>
          <div className="info-value">{order.amount.toLocaleString()} USDT</div>
        </div>
        <div className="info-item">
          <div className="label">환율</div>
          <div className="info-value">₩{new Intl.NumberFormat('ko-KR').format(order.priceKRW)}/USDT</div>
        </div>
      </div>

      <div className="divider" />

      <div className="buyer-list">
        {requests.map((req) => (
          <div key={`${req.orderId}-${req.buyer}`} className="buyer-item">
            <div className="buyer-info">
              <div className="mono sm">{shortAddr(req.buyer)}</div>
              <div className="muted sm">{formatTime(req.timestamp)}</div>
            </div>
            <div className="buyer-actions">
              <button
                className="btn btn-green btn-sm"
                onClick={() => onSelect(req.buyer)}
              >
                선택
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onReject(req.buyer)}
              >
                거절
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
