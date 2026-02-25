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
//   - 릴레이 3개 → 6개 후보 + 접속 전 헬스체크
//   - 고정 2초 sync 딜레이 제거 → 피어 join 시 즉시 sync 요청
//   - onPeerJoin/Leave를 내부에서 관리하여 콜백 충돌 방지

import { validateOrder, isOrderExpired, stripSensitiveFields } from '../types/order.js'
import { verifyOrder } from './signature.js'
import { putOrder, getAllOrders, deleteExpiredOrders } from './indexeddb.js'

const ORDERBOOK_APP_ID = 'miniswap-orderbook-v1'

// 릴레이 후보 6개 — 헬스체크 후 살아있는 것만 사용
const NOSTR_RELAYS_CANDIDATES = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
  'wss://nostr.wine',
  'wss://relay.primal.net',
]

const MIN_HEALTHY_RELAYS = 3    // 이 수 미만이면 전체 후보를 폴백으로 사용
const RELAY_CHECK_TIMEOUT = 4000 // ms — 릴레이 응답 대기 최대 시간

/**
 * WebSocket ping으로 릴레이 생존 여부 확인.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function checkRelay(url) {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url)
      const timer = setTimeout(() => {
        ws.close()
        resolve(false)
      }, RELAY_CHECK_TIMEOUT)
      ws.onopen = () => {
        clearTimeout(timer)
        ws.close()
        resolve(true)
      }
      ws.onerror = () => {
        clearTimeout(timer)
        resolve(false)
      }
    } catch {
      resolve(false)
    }
  })
}

/**
 * 후보 릴레이 중 응답하는 릴레이만 반환.
 * 건강한 릴레이가 MIN_HEALTHY_RELAYS 미만이면 전체 후보 폴백.
 *
 * @param {string[]} [candidates]
 * @returns {Promise<string[]>}
 */
export async function getHealthyRelays(candidates = NOSTR_RELAYS_CANDIDATES) {
  const results = await Promise.allSettled(
    candidates.map(async (url) => ({ url, ok: await checkRelay(url) }))
  )
  const healthy = results
    .filter(r => r.status === 'fulfilled' && r.value.ok)
    .map(r => r.value.url)

  if (healthy.length >= MIN_HEALTHY_RELAYS) {
    console.info(`[orderbook] 헬스체크 완료 — ${healthy.length}/${candidates.length} 릴레이 정상`, healthy)
    return healthy
  }

  console.warn(`[orderbook] 건강한 릴레이 부족(${healthy.length}개) — 전체 후보 폴백`)
  return candidates
}

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
 * @param {string}   [options.appId]           - Override app ID (테스트용)
 * @param {string[]} [options.relays]          - Override relay list (헬스체크 건너뜀)
 * @param {boolean}  [options.skipHealthCheck] - true면 헬스체크 생략
 * @returns {Promise<OrderbookRoom>}
 */
export async function createOrderbookRoom(options = {}) {
  const { joinRoom } = await import('trystero/nostr')

  const appId = options.appId || ORDERBOOK_APP_ID

  // 헬스체크: 릴레이 override가 없을 때만 실행
  const relays = options.relays
    ? options.relays
    : options.skipHealthCheck
      ? NOSTR_RELAYS_CANDIDATES
      : await getHealthyRelays()

  const room = joinRoom(
    { appId, relayUrls: relays },
    'orderbook'
  )

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
