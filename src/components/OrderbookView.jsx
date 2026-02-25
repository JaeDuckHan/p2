import { useState } from 'react'
import { useAccount } from 'wagmi'
import SellOrderForm from './SellOrderForm'
import BuyOrderForm from './BuyOrderForm'
import OrderDetail from './OrderDetail'
import BuyerSelector from './BuyerSelector'
import { getUserProfile, renderStars } from '../mockData'

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
 *
 * @param {Object}   orderbook        - useOrderbook hook 반환값
 * @param {function} onStartTrade     - 거래 시작 콜백
 * @param {boolean}  [myOrdersOnly]   - true면 내 오더만 표시 (내 오더 탭)
 */
export default function OrderbookView({ orderbook, onStartTrade, myOrdersOnly = false }) {
  const { address } = useAccount()

  const [tab, setTab] = useState('sell')
  const [formMode, setFormMode] = useState(null)   // null | 'sell-form' | 'buy-form'
  const [editingOrder, setEditingOrder] = useState(null)  // 수정 중인 오더
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectingBuyerForOrder, setSelectingBuyerForOrder] = useState(null)

  // 내 오더 탭: 모든 오더 중 내 것만, 일반 탭: 현재 탭 오더
  const allMyOrders = [
    ...orderbook.sellOrders.filter(o => o.seller?.toLowerCase() === address?.toLowerCase()),
    ...orderbook.buyOrders.filter(o => o.buyer?.toLowerCase() === address?.toLowerCase()),
  ]
  const orders = myOrdersOnly
    ? (tab === 'sell'
        ? orderbook.sellOrders.filter(o => o.seller?.toLowerCase() === address?.toLowerCase())
        : orderbook.buyOrders.filter(o => o.buyer?.toLowerCase() === address?.toLowerCase()))
    : (tab === 'sell' ? orderbook.sellOrders : orderbook.buyOrders)

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
          <button className="app-bar-back" onClick={() => { setFormMode(null); setEditingOrder(null) }}>←</button>
          <div className="app-bar-title">{editingOrder ? '✏️ 판매 오더 수정' : '📤 판매 오더 올리기'}</div>
          <div style={{ width: 32 }} />
        </div>
        <div className="pad">
          <SellOrderForm
            initialValues={editingOrder}
            onCreated={(order) => {
              if (editingOrder) {
                orderbook.cancelOrder(editingOrder.id)  // 기존 오더 취소
              }
              orderbook.postSellOrder(order)
              setFormMode(null)
              setEditingOrder(null)
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
          <button className="app-bar-back" onClick={() => { setFormMode(null); setEditingOrder(null) }}>←</button>
          <div className="app-bar-title">{editingOrder ? '✏️ 구매 오더 수정' : '📥 구매 오더 올리기'}</div>
          <div style={{ width: 32 }} />
        </div>
        <div className="pad">
          <BuyOrderForm
            initialValues={editingOrder}
            onCreated={(order) => {
              if (editingOrder) {
                orderbook.cancelOrder(editingOrder.id)  // 기존 오더 취소
              }
              orderbook.postBuyOrder(order)
              setFormMode(null)
              setEditingOrder(null)
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
          <div style={{ width: 36 }} />
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
          onCancelOrder={(orderId) => {
            orderbook.cancelOrder(orderId)
            setSelectedOrder(null)
          }}
          onEditOrder={(order) => {
            setEditingOrder(order)
            setFormMode(order.type === 'SELL' ? 'sell-form' : 'buy-form')
            setSelectedOrder(null)
          }}
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
          <div style={{ width: 36 }} />
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

  const totalOrders = orderbook.sellOrders.length + orderbook.buyOrders.length

  return (
    <div className="fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">{myOrdersOnly ? '내 오더' : '거래소'}</div>
          <div className="page-subtitle">
            <span className={`p2p-dot ${orderbook.connected ? 'on' : 'off'}`} />
            P2P · {
              !orderbook.connected
                ? '연결 중...'
                : orderbook.peerCount === 0
                  ? '대기 중 (나만 접속)'
                  : `${orderbook.peerCount + 1}명 접속`
            }
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

      {/* Hero CTA Section */}
      <div className="hero-connected">
        <div className="hero-connected-title">
          P2P USDT ↔ KRW<br/>
          <span className="accent">안전한 에스크로</span> 기반 거래
        </div>
        <div className="hero-connected-sub">
          스마트 컨트랙트가 자금을 보호합니다
        </div>
        <div className="hero-connected-ctas">
          <button className="hero-cta-btn sell" onClick={() => setFormMode('sell-form')}>
            📤 판매 시작하기
          </button>
          <button className="hero-cta-btn buy" onClick={() => setFormMode('buy-form')}>
            📥 구매 시작하기
          </button>
        </div>
      </div>

      {/* Live stats */}
      <div className="live-stats">
        <div className="live-stat">
          📊 오더 <span className="teal">{totalOrders}건</span>
        </div>
        <div className="live-stat">
          👥 접속 <span className="green">{orderbook.peerCount || 0}명</span>
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

      {/* Orderbook tabs — underline style */}
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
          <>&#x1F6E1;&#xFE0F; <strong style={{ color: 'var(--amber)' }}>판매 오더</strong> — 에스크로 보호 하에 USDT 구매 가능</>
        ) : (
          <>&#x1F6E1;&#xFE0F; <strong style={{ color: 'var(--blue)' }}>구매 오더</strong> — 에스크로 보호 하에 USDT 판매 가능</>
        )}
      </div>

      {/* CTA Buttons — prominent create order */}
      <div className="cta-row">
        <button
          className={`cta-create ${tab === 'sell' ? 'sell' : 'buy'}`}
          onClick={() => setFormMode(tab === 'sell' ? 'sell-form' : 'buy-form')}
        >
          + {tab === 'sell' ? '판매 오더 생성하기' : '구매 오더 생성하기'}
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

      {/* Order list or Empty state */}
      {orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            {tab === 'sell' ? '📤' : '📥'}
          </div>
          <div className="empty-title">
            아직 등록된 {tab === 'sell' ? '판매' : '구매'} 오더가 없습니다
          </div>
          <div className="empty-desc">
            첫 번째 거래자가 되어보세요.<br/>
            지금 등록하면 상단에 노출됩니다.
          </div>
          <button
            className="empty-cta"
            onClick={() => setFormMode(tab === 'sell' ? 'sell-form' : 'buy-form')}
          >
            + {tab === 'sell' ? '판매 오더 등록하기' : '구매 오더 등록하기'}
          </button>
        </div>
      ) : (
        <div className="pad">
          {orders.map(order => {
            const isSell = order.type === 'SELL'
            const ownerAddr = isSell ? order.seller : order.buyer
            const isOwn = ownerAddr?.toLowerCase() === address?.toLowerCase()
            const reqCount = orderbook.acceptRequests.filter(r => r.orderId === order.id).length
            const totalKRW = Math.round(order.amount * order.priceKRW)
            const profile = getUserProfile(ownerAddr)

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
                      <div className="stars">{renderStars(profile.rating)} <span className="stars-info">{profile.rating.toFixed(1)}</span></div>
                    </div>
                  </div>
                  {isOwn && reqCount > 0 ? (
                    <span className="badge badge-amber">🔔 요청 {reqCount}건</span>
                  ) : isOwn ? (
                    <span className="badge badge-teal">내 주문</span>
                  ) : isSell ? (
                    <span className="badge badge-green">🔒 에스크로</span>
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
                    <span>거래 {profile.tradeCount}회</span>
                  </div>
                  {isOwn ? (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingOrder(order)
                          setFormMode(order.type === 'SELL' ? 'sell-form' : 'buy-form')
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm('이 오더를 취소하시겠습니까?')) {
                            orderbook.cancelOrder(order.id)
                          }
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  ) : (
                    <button
                      className={`btn btn-sm ${isSell ? 'btn-blue' : 'btn-amber'}`}
                      onClick={(e) => { e.stopPropagation(); handleOrderClick(order) }}
                    >
                      {isSell ? '구매하기' : '판매하기'}
                    </button>
                  )}
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
