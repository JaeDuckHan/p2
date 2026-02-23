// ─── useOrderbook React Hook ─────────────────────────────────────────────────
//
// Wraps the Trystero P2P orderbook in React lifecycle.
// Order broadcast: Trystero (sell-orders, buy-orders, sync-req)
// Accept communication: XMTP 1:1 DM (accept-req, accept-res)
//
// Provides state: sellOrders, buyOrders, acceptRequests, peerCount, connected
// Provides actions: postSellOrder, postBuyOrder, requestAccept, respondAccept

import { useEffect, useRef, useState, useCallback } from 'react'
import { createOrderbookRoom } from '../lib/trystero-orderbook.js'
import { isOrderExpired } from '../types/order.js'
import { verifyAcceptRequest } from '../lib/signature.js'
import { deleteExpiredOrders, getAllOrders } from '../lib/indexeddb.js'
import { IdentifierKind, SortDirection, GroupMessageKind } from '@xmtp/browser-sdk'
import { useXmtp } from '../contexts/XmtpContext.jsx'

// Cleanup interval for expired orders (30 seconds)
const CLEANUP_INTERVAL_MS = 30_000

// XMTP message envelope type prefix for accept messages
const ACCEPT_REQ_TYPE = 'miniswap:accept-req'
const ACCEPT_RES_TYPE = 'miniswap:accept-res'
const TRADE_CREATED_TYPE = 'miniswap:trade-created'

/**
 * React hook for the decentralized P2P orderbook.
 *
 * @param {Object} options
 * @param {boolean} [options.enabled=true]  - Whether to connect to the orderbook
 */
export function useOrderbook({ enabled = true } = {}) {
  const [sellOrders,      setSellOrders]      = useState([])
  const [buyOrders,       setBuyOrders]       = useState([])
  const [acceptRequests,  setAcceptRequests]  = useState([])
  const [acceptResponses,   setAcceptResponses]   = useState([])
  const [tradeNotifications, setTradeNotifications] = useState([])
  const [peerCount,         setPeerCount]         = useState(0)

  const { client: xmtpClient, isReady: xmtpReady } = useXmtp()

  const roomRef       = useRef(null)
  const peersRef      = useRef(new Set())
  const sellOrdersRef = useRef(sellOrders)
  const xmtpStreamRef = useRef(null)

  // Keep ref in sync with state (for use in callbacks)
  useEffect(() => { sellOrdersRef.current = sellOrders }, [sellOrders])

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

  // ── Connect to P2P orderbook room (Trystero — orders only) ──────────────

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    createOrderbookRoom().then(room => {
      if (cancelled) {
        room.leave()
        return
      }

      roomRef.current = room

      room.onSellOrder((order) => {
        setSellOrders(prev => {
          if (prev.some(o => o.id === order.id)) return prev
          return [...prev, order]
        })
      })

      room.onBuyOrder((order) => {
        setBuyOrders(prev => {
          if (prev.some(o => o.id === order.id)) return prev
          return [...prev, order]
        })
      })

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

  // ── Stream XMTP DMs for accept-req / accept-res ─────────────────────────

  useEffect(() => {
    if (!enabled || !xmtpReady || !xmtpClient) return

    let cancelled = false

    async function startAcceptStream() {
      try {
        // Sync existing conversations to get any missed messages
        await xmtpClient.conversations.sync()
        if (cancelled) return

        // Load existing accept messages from DMs
        const dms = await xmtpClient.conversations.listDms()
        if (cancelled) return

        for (const dm of dms) {
          await dm.sync()
          const msgs = await dm.messages({ direction: SortDirection.Ascending })
          for (const msg of msgs) {
            if (msg.kind !== GroupMessageKind.Application) continue
            handleAcceptMessage(msg)
          }
        }

        // Stream new DM messages
        const stream = await xmtpClient.conversations.streamAllDmMessages()
        if (cancelled) {
          stream.end()
          return
        }
        xmtpStreamRef.current = stream

        for await (const msg of stream) {
          if (cancelled) break
          if (msg.kind !== GroupMessageKind.Application) continue
          if (msg.senderInboxId === xmtpClient.inboxId) continue
          handleAcceptMessage(msg)
        }
      } catch (err) {
        console.warn('[useOrderbook] XMTP accept stream error:', err)
      }
    }

    function handleAcceptMessage(msg) {
      try {
        const envelope = JSON.parse(msg.content)

        if (envelope.type === ACCEPT_REQ_TYPE) {
          const req = envelope.payload
          // Validate accept request signature
          if (req.signature) {
            const check = verifyAcceptRequest(req.orderId, req.buyer, req.signature)
            if (!check.valid) {
              console.warn('[useOrderbook] Bad accept-req signature')
              return
            }
          }
          setAcceptRequests(prev => {
            if (prev.some(r => r.orderId === req.orderId && r.buyer === req.buyer)) return prev
            return [...prev, req]
          })
        }

        if (envelope.type === ACCEPT_RES_TYPE) {
          const res = envelope.payload
          setAcceptResponses(prev => {
            if (prev.some(r => r.orderId === res.orderId && r.buyer === res.buyer)) return prev
            return [...prev, res]
          })
        }

        if (envelope.type === TRADE_CREATED_TYPE) {
          const notif = envelope.payload
          setTradeNotifications(prev => {
            if (prev.some(n => n.orderId === notif.orderId)) return prev
            return [...prev, notif]
          })
        }
      } catch {
        // Not a JSON accept message — ignore
      }
    }

    startAcceptStream()

    return () => {
      cancelled = true
      if (xmtpStreamRef.current) {
        xmtpStreamRef.current.end()
        xmtpStreamRef.current = null
      }
    }
  }, [enabled, xmtpReady, xmtpClient])

  // ── Periodic cleanup of expired orders ────────────────────────────────────

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      const now = Date.now()

      setSellOrders(prev => prev.filter(o => o.expiry > now))
      setBuyOrders(prev  => prev.filter(o => o.expiry > now))

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

  /**
   * Send accept request via XMTP DM to the seller.
   */
  const requestAccept = useCallback((req) => {
    if (!xmtpClient) {
      console.warn('[useOrderbook] XMTP not ready, cannot send accept request')
      return
    }

    // Find seller address from order
    const order = sellOrdersRef.current.find(o => o.id === req.orderId)
    if (!order?.seller) {
      console.warn('[useOrderbook] Cannot find seller for order:', req.orderId)
      return
    }

    const envelope = JSON.stringify({
      type: ACCEPT_REQ_TYPE,
      payload: req,
      timestamp: Date.now(),
    })

    xmtpClient.conversations
      .createDmWithIdentifier({ identifier: order.seller.toLowerCase(), identifierKind: IdentifierKind.Ethereum })
      .then(dm => dm.sendText(envelope))
      .catch(err => console.warn('[useOrderbook] Failed to send accept request:', err))
  }, [xmtpClient])

  /**
   * Send accept response via XMTP DM to the buyer.
   */
  const respondAccept = useCallback((res) => {
    if (!xmtpClient) {
      console.warn('[useOrderbook] XMTP not ready, cannot send accept response')
      return
    }

    // Remove the accept request from local state
    setAcceptRequests(prev =>
      prev.filter(r => !(r.orderId === res.orderId && r.buyer === res.buyer))
    )

    const envelope = JSON.stringify({
      type: ACCEPT_RES_TYPE,
      payload: res,
      timestamp: Date.now(),
    })

    // Send to the buyer
    xmtpClient.conversations
      .createDmWithIdentifier({ identifier: res.buyer.toLowerCase(), identifierKind: IdentifierKind.Ethereum })
      .then(dm => dm.sendText(envelope))
      .catch(err => console.warn('[useOrderbook] Failed to send accept response:', err))

    // If accepted, auto-reject all other requests for this order
    if (res.accepted) {
      setAcceptRequests(prev => {
        const remaining = prev.filter(r => r.orderId !== res.orderId)
        // Send reject to each remaining requester
        for (const r of prev.filter(rr => rr.orderId === res.orderId && rr.buyer !== res.buyer)) {
          const rejectEnvelope = JSON.stringify({
            type: ACCEPT_RES_TYPE,
            payload: { orderId: r.orderId, buyer: r.buyer, accepted: false },
            timestamp: Date.now(),
          })
          xmtpClient.conversations
            .createDmWithIdentifier({ identifier: r.buyer.toLowerCase(), identifierKind: IdentifierKind.Ethereum })
            .then(dm => dm.sendText(rejectEnvelope))
            .catch(err => console.warn('[useOrderbook] Failed to send reject:', err))
        }
        return remaining
      })
    }
  }, [xmtpClient])

  const removeOrder = useCallback((orderId) => {
    setSellOrders(prev => prev.filter(o => o.id !== orderId))
    setBuyOrders(prev  => prev.filter(o => o.id !== orderId))
    setAcceptRequests(prev => prev.filter(r => r.orderId !== orderId))
  }, [])

  /**
   * Notify the buyer that the seller has created an escrow trade.
   * Sends tradeId via XMTP DM so buyer can auto-join the trade room.
   */
  const notifyTradeCreated = useCallback((buyerAddress, orderId, tradeId) => {
    if (!xmtpClient) {
      console.warn('[useOrderbook] XMTP not ready, cannot send trade-created notification')
      return
    }

    const envelope = JSON.stringify({
      type: TRADE_CREATED_TYPE,
      payload: { orderId, tradeId, buyer: buyerAddress },
      timestamp: Date.now(),
    })

    xmtpClient.conversations
      .createDmWithIdentifier({ identifier: buyerAddress.toLowerCase(), identifierKind: IdentifierKind.Ethereum })
      .then(dm => dm.sendText(envelope))
      .catch(err => console.warn('[useOrderbook] Failed to send trade-created:', err))
  }, [xmtpClient])

  return {
    sellOrders,
    buyOrders,
    acceptRequests,
    acceptResponses,
    tradeNotifications,
    peerCount,
    connected: peerCount > 0,
    postSellOrder,
    postBuyOrder,
    requestAccept,
    respondAccept,
    notifyTradeCreated,
    removeOrder,
  }
}
