// ─── useOrderbook React Hook ─────────────────────────────────────────────────
//
// Wraps the Trystero P2P orderbook in React lifecycle.
// Connect on mount, disconnect on unmount.
// Provides state: sellOrders, buyOrders, acceptRequests, peerCount, connected
// Provides actions: postSellOrder, postBuyOrder, requestAccept, respondAccept

import { useEffect, useRef, useState, useCallback } from 'react'
import { createOrderbookRoom } from '../lib/trystero-orderbook.js'
import { isOrderExpired } from '../types/order.js'
import { deleteExpiredOrders, getAllOrders } from '../lib/indexeddb.js'

// Cleanup interval for expired orders (30 seconds)
const CLEANUP_INTERVAL_MS = 30_000

/**
 * React hook for the decentralized P2P orderbook.
 *
 * @param {Object} options
 * @param {boolean} [options.enabled=true]  - Whether to connect to the orderbook
 * @returns {{
 *   sellOrders:     import('../types/order.js').SellOrder[],
 *   buyOrders:      import('../types/order.js').BuyOrder[],
 *   acceptRequests: import('../types/order.js').AcceptRequest[],
 *   acceptResponses: import('../types/order.js').AcceptResponse[],
 *   peerCount:      number,
 *   connected:      boolean,
 *   postSellOrder:  function(import('../types/order.js').SellOrder): void,
 *   postBuyOrder:   function(import('../types/order.js').BuyOrder): void,
 *   requestAccept:  function(import('../types/order.js').AcceptRequest): void,
 *   respondAccept:  function(import('../types/order.js').AcceptResponse): void,
 *   removeOrder:    function(string): void,
 * }}
 */
export function useOrderbook({ enabled = true } = {}) {
  const [sellOrders,      setSellOrders]      = useState([])
  const [buyOrders,       setBuyOrders]       = useState([])
  const [acceptRequests,  setAcceptRequests]  = useState([])
  const [acceptResponses, setAcceptResponses] = useState([])
  const [peerCount,       setPeerCount]       = useState(0)

  const roomRef  = useRef(null)
  const peersRef = useRef(new Set())

  // ── Load persisted orders on mount ────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    deleteExpiredOrders()
      .then(() => getAllOrders())
      .then(orders => {
        const sells = orders.filter(o => o.type === 'SELL' && !isOrderExpired(o))
        const buys  = orders.filter(o => o.type === 'BUY'  && !isOrderExpired(o))
        setSellOrders(sells)
        setBuyOrders(buys)
      })
      .catch(err => console.warn('[useOrderbook] Failed to load persisted orders:', err))
  }, [enabled])

  // ── Connect to P2P orderbook room ─────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    createOrderbookRoom().then(room => {
      if (cancelled) {
        room.leave()
        return
      }

      roomRef.current = room

      // ── Sell orders ────────────────────────────────────────────────────

      room.onSellOrder((order) => {
        setSellOrders(prev => {
          if (prev.some(o => o.id === order.id)) return prev
          return [...prev, order]
        })
      })

      // ── Buy orders ─────────────────────────────────────────────────────

      room.onBuyOrder((order) => {
        setBuyOrders(prev => {
          if (prev.some(o => o.id === order.id)) return prev
          return [...prev, order]
        })
      })

      // ── Accept requests (seller receives these) ────────────────────────

      room.onAcceptReq((req) => {
        setAcceptRequests(prev => {
          // Deduplicate by orderId + buyer
          if (prev.some(r => r.orderId === req.orderId && r.buyer === req.buyer)) {
            return prev
          }
          return [...prev, req]
        })
      })

      // ── Accept responses (buyer receives these) ────────────────────────

      room.onAcceptRes((res) => {
        setAcceptResponses(prev => {
          if (prev.some(r => r.orderId === res.orderId && r.buyer === res.buyer)) {
            return prev
          }
          return [...prev, res]
        })
      })

      // ── Peer tracking ──────────────────────────────────────────────────

      room.onPeerJoin((peerId) => {
        peersRef.current.add(peerId)
        setPeerCount(peersRef.current.size)
      })

      room.onPeerLeave((peerId) => {
        peersRef.current.delete(peerId)
        setPeerCount(peersRef.current.size)
      })
    }).catch(err => {
      console.warn('[useOrderbook] Failed to connect:', err)
    })

    return () => {
      cancelled = true
      if (roomRef.current) {
        roomRef.current.leave()
        roomRef.current = null
      }
      peersRef.current.clear()
      setPeerCount(0)
    }
  }, [enabled])

  // ── Periodic cleanup of expired orders ────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      const now = Date.now()

      setSellOrders(prev => prev.filter(o => o.expiry > now))
      setBuyOrders(prev  => prev.filter(o => o.expiry > now))

      // Also clean up accept requests for orders that no longer exist
      setSellOrders(currentSells => {
        const sellIds = new Set(currentSells.map(o => o.id))
        setAcceptRequests(prev => prev.filter(r => sellIds.has(r.orderId)))
        return currentSells
      })

      deleteExpiredOrders().catch(() => {})
    }, CLEANUP_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [enabled])

  // ── Actions ───────────────────────────────────────────────────────────────

  const postSellOrder = useCallback((order) => {
    setSellOrders(prev => {
      if (prev.some(o => o.id === order.id)) return prev
      return [...prev, order]
    })
    if (roomRef.current) {
      roomRef.current.broadcastSellOrder(order)
    }
  }, [])

  const postBuyOrder = useCallback((order) => {
    setBuyOrders(prev => {
      if (prev.some(o => o.id === order.id)) return prev
      return [...prev, order]
    })
    if (roomRef.current) {
      roomRef.current.broadcastBuyOrder(order)
    }
  }, [])

  const requestAccept = useCallback((req) => {
    if (roomRef.current) {
      roomRef.current.sendAcceptReq(req)
    }
  }, [])

  const respondAccept = useCallback((res) => {
    // Remove the accept request from local state
    setAcceptRequests(prev =>
      prev.filter(r => !(r.orderId === res.orderId && r.buyer === res.buyer))
    )
    if (roomRef.current) {
      roomRef.current.sendAcceptRes(res)
    }

    // If rejected, also auto-reject all other requests for the same order
    if (res.accepted) {
      setAcceptRequests(prev => {
        const remaining = prev.filter(r => r.orderId !== res.orderId)
        // Send reject to each remaining requester
        for (const r of prev.filter(rr => rr.orderId === res.orderId && rr.buyer !== res.buyer)) {
          if (roomRef.current) {
            roomRef.current.sendAcceptRes({
              orderId:  r.orderId,
              buyer:    r.buyer,
              accepted: false,
            })
          }
        }
        return remaining
      })
    }
  }, [])

  const removeOrder = useCallback((orderId) => {
    setSellOrders(prev => prev.filter(o => o.id !== orderId))
    setBuyOrders(prev  => prev.filter(o => o.id !== orderId))
    setAcceptRequests(prev => prev.filter(r => r.orderId !== orderId))
  }, [])

  return {
    sellOrders,
    buyOrders,
    acceptRequests,
    acceptResponses,
    peerCount,
    connected: peerCount > 0,
    postSellOrder,
    postBuyOrder,
    requestAccept,
    respondAccept,
    removeOrder,
  }
}
