// ─── Trystero P2P Orderbook ───────────────────────────────────────────────────
//
// Decentralized orderbook using Trystero/Nostr for WebRTC signaling.
// Orders are broadcast peer-to-peer — no central server.
//
// Channels:
//   sell-orders  — broadcast/receive sell orders
//   buy-orders   — broadcast/receive buy orders
//   sync-req     — request full orderbook from peers on join
//
// NOTE: accept-req / accept-res are now handled via XMTP DM (see useOrderbook.js)
//
// v2 개선:
//   - Trystero 내장 릴레이 사용 (appId 기반 deterministic 선택)
//   - 고정 2초 sync 딜레이 제거 → 피어 join 시 즉시 sync 요청
//   - onPeerJoin/Leave를 내부에서 관리하여 콜백 충돌 방지

import { validateOrder, isOrderExpired, stripSensitiveFields } from '../types/order.js'
import { verifyOrder } from './signature.js'
import { putOrder, getAllOrders, deleteExpiredOrders } from './indexeddb.js'

const ORDERBOOK_APP_ID_PREFIX = 'miniswap-orderbook-v1'

/**
 * @typedef {Object} OrderbookRoom
 * @property {function(import('../types/order.js').SellOrder): void} broadcastSellOrder
 * @property {function(import('../types/order.js').BuyOrder): void}  broadcastBuyOrder
 * @property {function(function(import('../types/order.js').SellOrder, string): void): void} onSellOrder
 * @property {function(function(import('../types/order.js').BuyOrder, string): void): void}  onBuyOrder
 * @property {function(function(string): void): void} onPeerJoin
 * @property {function(function(string): void): void} onPeerLeave
 * @property {function(): string[]} getPeers
 * @property {function(): void} leave
 */

/**
 * Create and join the P2P orderbook room.
 *
 * @param {Object}   [options]
 * @param {string}   [options.networkKey]      - Network key for room isolation
 * @param {string}   [options.appId]           - Override app ID (테스트용)
 * @param {string[]} [options.relays]          - Override relay list
 * @returns {Promise<OrderbookRoom>}
 */
export async function createOrderbookRoom(options = {}) {
  const { joinRoom } = await import('trystero/nostr')

  // 네트워크별 오더북 격리: appId에 networkKey를 포함하여 서로 다른 방 사용
  const networkSuffix = options.networkKey ? `-${options.networkKey}` : ''
  const appId = options.appId || `${ORDERBOOK_APP_ID_PREFIX}${networkSuffix}`

  // Trystero 내장 릴레이 사용 (appId 기반 deterministic 선택)
  // 모든 유저가 같은 appId → 같은 릴레이 5개 → 서로 발견 가능
  const config = options.relays
    ? { appId, relayUrls: options.relays }
    : { appId }

  const room = joinRoom(config, 'orderbook')

  // ── Create channels ──────────────────────────────────────────────────────

  const [sendSell,    receiveSell]    = room.makeAction('sell-orders')
  const [sendBuy,     receiveBuy]     = room.makeAction('buy-orders')
  const [sendSync,    receiveSync]    = room.makeAction('sync-req')
  const [sendCancel,  receiveCancel]  = room.makeAction('cancel-order')

  // ── Track known order IDs to avoid duplicate processing ──────────────────

  const knownOrderIds = new Set()

  // ── Callbacks ────────────────────────────────────────────────────────────

  let _onSellOrder   = null
  let _onBuyOrder    = null
  let _onPeerJoin    = null
  let _onPeerLeave   = null
  let _onCancelOrder = null

  // ── Incoming order handler (validate + deduplicate + persist) ─────────

  function handleIncomingOrder(order, peerId, callback) {
    if (knownOrderIds.has(order.id)) return

    const check = validateOrder(order)
    if (!check.valid) {
      console.warn(`[orderbook] Invalid order from ${peerId}: ${check.reason}`)
      return
    }

    const sig = verifyOrder(order)
    if (!sig.valid) {
      console.warn(`[orderbook] Bad signature from ${peerId}: ${sig.reason}`)
      return
    }

    if (isOrderExpired(order)) return

    knownOrderIds.add(order.id)
    putOrder(order).catch(err => {
      console.warn('[orderbook] Failed to persist order:', err)
    })

    if (callback) callback(order, peerId)
  }

  // ── Wire up receive handlers ─────────────────────────────────────────────

  receiveSell((order, peerId) => {
    handleIncomingOrder(order, peerId, _onSellOrder)
  })

  receiveBuy((order, peerId) => {
    handleIncomingOrder(order, peerId, _onBuyOrder)
  })

  // ── Sync: 피어가 sync 요청하면 우리 주문 전부 전달 ───────────────────────

  receiveSync(async (_data, peerId) => {
    try {
      await deleteExpiredOrders()
      const orders = await getAllOrders()
      for (const order of orders) {
        if (isOrderExpired(order)) continue
        const stripped = order.type === 'SELL' ? stripSensitiveFields(order) : order
        if (order.type === 'SELL') {
          sendSell(stripped, peerId)
        } else {
          sendBuy(stripped, peerId)
        }
      }
    } catch (err) {
      console.warn('[orderbook] Sync failed:', err)
    }
  })

  // ── 주문 취소 수신 — 로컬에서 제거 ─────────────────────────────────────

  receiveCancel(({ id }) => {
    if (!id) return
    knownOrderIds.delete(id)  // 재브로드캐스트 허용 안 함
    if (_onCancelOrder) _onCancelOrder(id)
  })

  // ── 피어 join 시 즉시 sync 요청 (고정 2초 딜레이 제거) ──────────────────
  // 연결된 피어에게 바로 sync → 주문 수신 지연 최소화

  room.onPeerJoin((peerId) => {
    sendSync({ type: 'sync' }, peerId)  // 해당 피어에게만 요청
    if (_onPeerJoin) _onPeerJoin(peerId)
  })

  room.onPeerLeave((peerId) => {
    if (_onPeerLeave) _onPeerLeave(peerId)
  })

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    broadcastSellOrder(order) {
      knownOrderIds.add(order.id)
      putOrder(order).catch(() => {})
      sendSell(stripSensitiveFields(order))
    },

    broadcastBuyOrder(order) {
      knownOrderIds.add(order.id)
      putOrder(order).catch(() => {})
      sendBuy(order)
    },

    onSellOrder(cb)    { _onSellOrder   = cb },
    onBuyOrder(cb)     { _onBuyOrder    = cb },
    onPeerJoin(cb)     { _onPeerJoin    = cb },
    onPeerLeave(cb)    { _onPeerLeave   = cb },
    onCancelOrder(cb)  { _onCancelOrder = cb },

    /**
     * 주문 취소를 모든 피어에게 브로드캐스트.
     * @param {string} orderId
     */
    broadcastCancelOrder(orderId) {
      knownOrderIds.delete(orderId)
      sendCancel({ id: orderId })
    },

    getPeers() { return [] },

    leave() {
      try { room.leave() } catch {}
    },
  }
}
