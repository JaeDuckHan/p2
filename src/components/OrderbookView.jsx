import { useState } from 'react'
import { useAccount } from 'wagmi'
import SellOrderForm from './SellOrderForm'
import BuyOrderForm from './BuyOrderForm'
import OrderDetail from './OrderDetail'
import BuyerSelector from './BuyerSelector'

// Avatar gradient presets
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #00d4b8, #0088cc)',
  'linear-gradient(135deg, #9b4fff, #4d8fff)',
  'linear-gradient(135deg, #22e88a, #00aa55)',
  'linear-gradient(135deg, #ff8800, #ff3399)',
  'linear-gradient(135deg, #ffb547, #ff5870)',
  'linear-gradient(135deg, #4d8fff, #00d4b8)',
]

function getAvatarGradient(addr) {
  if (!addr) return AVATAR_GRADIENTS[0]
  const idx = parseInt(addr.slice(-4), 16) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[idx]
}

function getAvatarChar(addr) {
  if (!addr) return '?'
  return addr.slice(2, 4).toUpperCase()
}

export { getAvatarGradient, getAvatarChar }

/**
 * OrderbookView — Main orderbook container with sell/buy tabs.
 */
export default function OrderbookView({ orderbook, onStartTrade }) {
  const { address } = useAccount()

  const [tab, setTab] = useState('sell')
  const [formMode, setFormMode] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectingBuyerForOrder, setSelectingBuyerForOrder] = useState(null)

  const orders = tab === 'sell' ? orderbook.sellOrders : orderbook.buyOrders

  const myAcceptRequests = orderbook.acceptRequests.filter(r => {
    const order = orderbook.sellOrders.find(o => o.id === r.orderId)
    return order && order.seller?.toLowerCase() === address?.toLowerCase()
  })

  function handleOrderClick(order) {
    if (
      order.type === 'SELL' &&
      order.seller?.toLowerCase() === address?.toLowerCase()
    ) {
      const reqs = orderbook.acceptRequests.filter(r => r.orderId === order.id)
      if (reqs.length > 0) {
        setSelectingBuyerForOrder(order.id)
        return
      }
    }
    setSelectedOrder(order)
  }

  function handleAcceptSent() {
    setSelectedOrder(null)
  }

  function handleBuyerSelected(orderId, buyerAddress) {
    setSelectingBuyerForOrder(null)
    if (onStartTrade) {
      onStartTrade(null, 'seller', { orderId, buyerAddress })
    }
  }

  function formatExpiry(expiry) {
    const remaining = expiry - Date.now()
    if (remaining <= 0) return '만료됨'
    const min = Math.floor(remaining / 60000)
    if (min < 60) return `${min}분`
    const hr = Math.floor(min / 60)
    return `${hr}h`
  }

  function formatKRW(n) {
    return new Intl.NumberFormat('ko-KR').format(n)
  }

  function shortAddr(addr) {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  // ── Form views ──────────────────────────────────────────────────────────

  if (formMode === 'sell-form') {
    return (
      <div className="fade-in">
        <div className="app-bar">
          <button className="app-bar-back" onClick={() => setFormMode(null)}>←</button>
          <div className="app-bar-title">📤 판매 오더 올리기</div>
          <div style={{ width: 32 }} />
        </div>
        <div className="pad">
          <SellOrderForm
            onCreated={(order) => {
              orderbook.postSellOrder(order)
              setFormMode(null)
            }}
          />
        </div>
      </div>
    )
  }

  if (formMode === 'buy-form') {
    return (
      <div className="fade-in">
        <div className="app-bar">
          <button className="app-bar-back" onClick={() => setFormMode(null)}>←</button>
          <div className="app-bar-title">📥 구매 오더 올리기</div>
          <div style={{ width: 32 }} />
        </div>
        <div className="pad">
          <BuyOrderForm
            onCreated={(order) => {
              orderbook.postBuyOrder(order)
              setFormMode(null)
            }}
          />
        </div>
      </div>
    )
  }

  // ── Order detail view ───────────────────────────────────────────────────

  if (selectedOrder) {
    return (
      <div className="fade-in">
        <div className="app-bar">
          <button className="app-bar-back" onClick={() => setSelectedOrder(null)}>←</button>
          <div className="app-bar-title">
            {selectedOrder.type === 'SELL' ? '판매 오더 상세' : '구매 오더 상세'}
          </div>
          <div style={{ width: 32 }} />
        </div>
        <OrderDetail
          order={selectedOrder}
          onAcceptSent={handleAcceptSent}
          onCancel={() => setSelectedOrder(null)}
          acceptResponse={orderbook.acceptResponses.find(
            r => r.orderId === selectedOrder.id &&
                 r.buyer?.toLowerCase() === address?.toLowerCase()
          )}
          tradeNotification={orderbook.tradeNotifications?.find(
            n => n.orderId === selectedOrder.id
          )}
          onStartTrade={onStartTrade}
        />
      </div>
    )
  }

  // ── Buyer selector view ─────────────────────────────────────────────────

  if (selectingBuyerForOrder) {
    const order = orderbook.sellOrders.find(o => o.id === selectingBuyerForOrder)
    const reqs = orderbook.acceptRequests.filter(r => r.orderId === selectingBuyerForOrder)
    return (
      <div className="fade-in">
        <div className="app-bar">
          <button className="app-bar-back" onClick={() => setSelectingBuyerForOrder(null)}>←</button>
          <div className="app-bar-title">구매 요청</div>
          <div style={{ width: 32 }} />
        </div>
        <BuyerSelector
          order={order}
          requests={reqs}
          onSelect={(buyerAddress) => {
            orderbook.respondAccept({
              orderId: selectingBuyerForOrder,
              buyer: buyerAddress,
              accepted: true,
              bankAccount: order?.bankAccount || '',
            })
            handleBuyerSelected(selectingBuyerForOrder, buyerAddress)
          }}
          onReject={(buyerAddress) => {
            orderbook.respondAccept({
              orderId: selectingBuyerForOrder,
              buyer: buyerAddress,
              accepted: false,
            })
          }}
        />
      </div>
    )
  }

  // ── Main orderbook list ─────────────────────────────────────────────────

  return (
    <div className="fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">거래소</div>
          <div className="page-subtitle">
            <span className="p2p-dot on" />
            P2P · {orderbook.connected ? `${orderbook.peerCount}명 접속` : '연결 중...'}
          </div>
        </div>
        <div className="page-actions">
          <div className="avatar avatar-md" style={{
            background: getAvatarGradient(address),
            color: 'var(--ink)',
            cursor: 'pointer',
          }}>
            {getAvatarChar(address)}
          </div>
        </div>
      </div>

      {/* Accept request notification */}
      {myAcceptRequests.length > 0 && (
        <div className="pad" style={{ paddingTop: 8 }}>
          <div className="banner banner-amber">
            <span className="banner-icon">🔔</span>
            <div className="banner-body">
              <div className="banner-title">{myAcceptRequests.length}건의 수락 요청</div>
              <div className="banner-text">내 주문을 클릭하여 구매자를 선택하세요</div>
            </div>
          </div>
        </div>
      )}

      {/* Orderbook tabs */}
      <div className="ob-tabs">
        <div
          className={`ob-tab ${tab === 'sell' ? 'sell-active' : ''}`}
          onClick={() => setTab('sell')}
        >
          📤 판매 오더
        </div>
        <div
          className={`ob-tab ${tab === 'buy' ? 'buy-active' : ''}`}
          onClick={() => setTab('buy')}
        >
          📥 구매 오더
        </div>
      </div>

      {/* Tab description */}
      <div className="ob-desc">
        {tab === 'sell' ? (
          <>💡 <strong style={{ color: 'var(--amber)' }}>판매 오더</strong> — USDT 팔고 싶은 사람들의 목록. 구매자가 수락하면 거래 시작.</>
        ) : (
          <>💡 <strong style={{ color: 'var(--blue)' }}>구매 오더</strong> — USDT 사고 싶은 사람들의 목록. 판매자가 수락하면 바로 에스크로 락.</>
        )}
      </div>

      {/* Action buttons */}
      <div className="action-row">
        <button
          className="btn btn-sm btn-amber"
          style={{ flex: 1, padding: 10 }}
          onClick={() => setFormMode('sell-form')}
        >
          📤 판매 오더 올리기
        </button>
        <button
          className="btn btn-sm btn-blue"
          style={{ flex: 1, padding: 10 }}
          onClick={() => setFormMode('buy-form')}
        >
          📥 구매 오더 올리기
        </button>
      </div>

      {/* Filters */}
      <div className="chips">
        <div className="chip active">전체</div>
        <div className="chip">~100</div>
        <div className="chip">100~500</div>
        <div className="chip">신뢰</div>
      </div>

      {/* Order count */}
      <div className="pad">
        <div className={`ob-count ${tab}`}>
          {tab === 'sell' ? '📤' : '📥'} {tab === 'sell' ? '판매' : '구매'} 오더 · {orders.length}건
        </div>
      </div>

      {/* Order list */}
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>
            {tab === 'sell' ? '📤' : '📥'}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            {tab === 'sell' ? '매도' : '매수'} 주문이 없습니다
          </div>
          <div className="sm muted">피어가 연결되면 주문이 표시됩니다</div>
        </div>
      ) : (
        <div className="pad">
          {orders.map(order => {
            const isSell = order.type === 'SELL'
            const ownerAddr = isSell ? order.seller : order.buyer
            const isOwn = ownerAddr?.toLowerCase() === address?.toLowerCase()
            const reqCount = orderbook.acceptRequests.filter(r => r.orderId === order.id).length
            const totalKRW = Math.round(order.amount * order.priceKRW)

            return (
              <div
                key={order.id}
                className={`order-card ${isSell ? 'sell-card' : 'buy-card'}`}
                onClick={() => handleOrderClick(order)}
              >
                {/* Top: seller info + badge */}
                <div className="oc-top">
                  <div className="oc-seller">
                    <div
                      className="avatar avatar-sm"
                      style={{ background: getAvatarGradient(ownerAddr), color: 'var(--ink)' }}
                    >
                      {getAvatarChar(ownerAddr)}
                    </div>
                    <div>
                      <div className="oc-seller-addr">{shortAddr(ownerAddr)}</div>
                      <div className="stars">★★★★★ <span className="stars-info">5.0</span></div>
                    </div>
                  </div>
                  {isOwn && reqCount > 0 ? (
                    <span className="badge badge-amber">🔔 요청 {reqCount}건</span>
                  ) : isOwn ? (
                    <span className="badge badge-teal">내 주문</span>
                  ) : isSell ? (
                    <span className="badge badge-green">🔒 에스크로↑</span>
                  ) : (
                    <span className="badge badge-blue">📥 구매 희망</span>
                  )}
                </div>

                {/* Mid: amount + KRW */}
                <div className="oc-mid">
                  <div>
                    <span className="oc-amount">{order.amount.toLocaleString()}</span>
                    <span className="oc-amount-unit">USDT</span>
                  </div>
                  <div className="oc-krw">
                    <div className={`oc-krw-val ${isSell ? 'sell' : 'buy'}`}>
                      {formatKRW(totalKRW)}원
                    </div>
                    <div className="oc-rate">
                      {formatKRW(order.priceKRW)}원/USDT
                    </div>
                  </div>
                </div>

                {/* Bottom: meta + action */}
                <div className="oc-bottom">
                  <div className="oc-meta">
                    <span>⏱ {formatExpiry(order.expiry)}</span>
                  </div>
                  <button
                    className={`btn btn-sm ${isSell ? 'btn-blue' : 'btn-amber'}`}
                    onClick={(e) => { e.stopPropagation(); handleOrderClick(order) }}
                  >
                    {isSell ? '구매하기' : '판매하기'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="scroll-gap" />
    </div>
  )
}
