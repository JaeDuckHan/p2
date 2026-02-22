import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useOrderbook } from '../hooks/useOrderbook'
import SellOrderForm from './SellOrderForm'
import BuyOrderForm from './BuyOrderForm'
import OrderDetail from './OrderDetail'
import BuyerSelector from './BuyerSelector'

/**
 * OrderbookView — Main orderbook container with sell/buy tabs.
 *
 * @param {Object} props
 * @param {function(string, string): void} props.onStartTrade - Called when trade starts (tradeId, role)
 */
export default function OrderbookView({ onStartTrade }) {
  const { address } = useAccount()
  const orderbook = useOrderbook()

  // 'sell' | 'buy'
  const [tab, setTab] = useState('sell')
  // null | 'sell-form' | 'buy-form'
  const [formMode, setFormMode] = useState(null)
  // Selected order for detail view
  const [selectedOrder, setSelectedOrder] = useState(null)
  // Order ID where seller is choosing buyer
  const [selectingBuyerForOrder, setSelectingBuyerForOrder] = useState(null)

  const orders = tab === 'sell' ? orderbook.sellOrders : orderbook.buyOrders

  // Accept requests for seller's own orders
  const myAcceptRequests = orderbook.acceptRequests.filter(r => {
    const order = orderbook.sellOrders.find(o => o.id === r.orderId)
    return order && order.seller?.toLowerCase() === address?.toLowerCase()
  })

  function handleOrderClick(order) {
    // If this is seller's own order and has accept requests, show buyer selector
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
    // Trigger on-chain deposit flow: seller creates escrow with selected buyer
    if (onStartTrade) {
      onStartTrade(null, 'seller', { orderId, buyerAddress })
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────

  function formatExpiry(expiry) {
    const remaining = expiry - Date.now()
    if (remaining <= 0) return '만료됨'
    const min = Math.floor(remaining / 60000)
    if (min < 60) return `${min}분 남음`
    const hr = Math.floor(min / 60)
    return `${hr}시간 ${min % 60}분 남음`
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
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setFormMode(null)}>
          ← 오더북으로 돌아가기
        </button>
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-title">매도 주문 생성</div>
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
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setFormMode(null)}>
          ← 오더북으로 돌아가기
        </button>
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-title">매수 주문 생성</div>
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
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(null)}>
          ← 오더북으로 돌아가기
        </button>
        <OrderDetail
          order={selectedOrder}
          onAcceptSent={handleAcceptSent}
          acceptResponse={orderbook.acceptResponses.find(
            r => r.orderId === selectedOrder.id &&
                 r.buyer?.toLowerCase() === address?.toLowerCase()
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
      <div>
        <button className="btn btn-ghost btn-sm" onClick={() => setSelectingBuyerForOrder(null)}>
          ← 오더북으로 돌아가기
        </button>
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
    <div>
      {/* P2P connection status */}
      <div className="p2p-bar">
        <span className={`p2p-dot ${orderbook.connected ? 'on' : 'off'}`} />
        <span>
          {orderbook.connected
            ? `${orderbook.peerCount}명 연결됨`
            : '피어 검색 중…'}
        </span>
      </div>

      {/* Accept request notification */}
      {myAcceptRequests.length > 0 && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          {myAcceptRequests.length}건의 수락 요청이 있습니다.
          내 주문을 클릭하여 구매자를 선택하세요.
        </div>
      )}

      {/* Tabs */}
      <div className="ob-tabs">
        <button
          className={`ob-tab ${tab === 'sell' ? 'active' : ''}`}
          onClick={() => setTab('sell')}
        >
          매도 주문
          {orderbook.sellOrders.length > 0 && (
            <span className="ob-tab-count">{orderbook.sellOrders.length}</span>
          )}
        </button>
        <button
          className={`ob-tab ${tab === 'buy' ? 'active' : ''}`}
          onClick={() => setTab('buy')}
        >
          매수 주문
          {orderbook.buyOrders.length > 0 && (
            <span className="ob-tab-count">{orderbook.buyOrders.length}</span>
          )}
        </button>
      </div>

      {/* Create order button */}
      <div style={{ margin: '1rem 0' }}>
        <button
          className="btn btn-green btn-block"
          onClick={() => setFormMode(tab === 'sell' ? 'sell-form' : 'buy-form')}
        >
          {tab === 'sell' ? '+ 매도 주문 등록' : '+ 매수 주문 등록'}
        </button>
      </div>

      {/* Order list */}
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            {tab === 'sell' ? '📤' : '📥'}
          </div>
          <p>{tab === 'sell' ? '매도' : '매수'} 주문이 없습니다</p>
          <p className="sm">피어가 연결되면 주문이 표시됩니다</p>
        </div>
      ) : (
        <div className="ob-list">
          {orders.map(order => {
            const isOwn = (order.type === 'SELL'
              ? order.seller
              : order.buyer
            )?.toLowerCase() === address?.toLowerCase()
            const reqCount = orderbook.acceptRequests.filter(r => r.orderId === order.id).length

            return (
              <div
                key={order.id}
                className={`ob-item ${isOwn ? 'own' : ''}`}
                onClick={() => handleOrderClick(order)}
              >
                <div className="ob-item-header">
                  <span className="ob-item-amount">
                    {order.amount.toLocaleString()} USDT
                  </span>
                  <span className="ob-item-expiry">{formatExpiry(order.expiry)}</span>
                </div>
                <div className="ob-item-body">
                  <span className="ob-item-price">
                    ₩{formatKRW(order.priceKRW)}/USDT
                  </span>
                  <span className="ob-item-total muted sm">
                    총 ₩{formatKRW(Math.round(order.amount * order.priceKRW))}
                  </span>
                </div>
                <div className="ob-item-footer">
                  <span className="mono sm">
                    {isOwn ? '내 주문' : shortAddr(order.type === 'SELL' ? order.seller : order.buyer)}
                  </span>
                  {isOwn && reqCount > 0 && (
                    <span className="badge badge-locked">
                      수락 요청 {reqCount}건
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
