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

import { validateOrder, isOrderExpired, stripSensitiveFields } from '../types/order.js'
import { verifyOrder } from './signature.js'
import { putOrder, getAllOrders, deleteExpiredOrders } from './indexeddb.js'

const ORDERBOOK_APP_ID = 'miniswap-orderbook-v1'

const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]

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
 * @param {Object} [options]
 * @param {string} [options.appId]     - Override app ID (for testing)
 * @param {string[]} [options.relays]  - Override relay list
 * @returns {Promise<OrderbookRoom>}
 */
export async function createOrderbookRoom(options = {}) {
  const { joinRoom } = await import('trystero/nostr')

  const appId  = options.appId  || ORDERBOOK_APP_ID
  const relays = options.relays || NOSTR_RELAYS

  const room = joinRoom(
    { appId, relayUrls: relays },
    'orderbook'   // single global room for order discovery
  )

  // ── Create channels ──────────────────────────────────────────────────────

  const [sendSell,    receiveSell]    = room.makeAction('sell-orders')
  const [sendBuy,     receiveBuy]     = room.makeAction('buy-orders')
  const [sendSync,    receiveSync]    = room.makeAction('sync-req')

  // ── Track known order IDs to avoid duplicate processing ──────────────────

  const knownOrderIds = new Set()

  // ── Callbacks ────────────────────────────────────────────────────────────

  let _onSellOrder  = null
  let _onBuyOrder   = null

  // ── Incoming order handler (validate + deduplicate + persist) ─────────

  function handleIncomingOrder(order, peerId, callback) {
    // Skip if already known
    if (knownOrderIds.has(order.id)) return

    // Structural validation
    const check = validateOrder(order)
    if (!check.valid) {
      console.warn(`[orderbook] Invalid order from ${peerId}: ${check.reason}`)
      return
    }

    // Cryptographic signature verification
    const sig = verifyOrder(order)
    if (!sig.valid) {
      console.warn(`[orderbook] Bad signature from ${peerId}: ${sig.reason}`)
      return
    }

    // Expired check
    if (isOrderExpired(order)) return

    // Accept the order
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

  // ── Sync: when a new peer joins, send them our current orders ────────────

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

  // Request sync from all peers after a short delay (let connections establish)
  setTimeout(() => {
    sendSync({ type: 'sync' })
  }, 2000)

  // ── Public API ───────────────────────────────────────────────────────────

  return {
    /**
     * Broadcast a sell order to all peers.
     * The order should already be signed.
     * bankAccount is stripped before broadcasting.
     */
    broadcastSellOrder(order) {
      knownOrderIds.add(order.id)
      putOrder(order).catch(() => {})
      sendSell(stripSensitiveFields(order))
    },

    /**
     * Broadcast a buy order to all peers.
     */
    broadcastBuyOrder(order) {
      knownOrderIds.add(order.id)
      putOrder(order).catch(() => {})
      sendBuy(order)
    },

    // ── Callback setters ─────────────────────────────────────────────────

    onSellOrder(cb)  { _onSellOrder = cb },
    onBuyOrder(cb)   { _onBuyOrder  = cb },

    onPeerJoin(cb)   { room.onPeerJoin(cb) },
    onPeerLeave(cb)  { room.onPeerLeave(cb) },

    getPeers() {
      // Trystero doesn't expose a peer list directly,
      // so the consumer should track via onPeerJoin/Leave
      return []
    },

    leave() {
      try { room.leave() } catch {}
    },
  }
}
