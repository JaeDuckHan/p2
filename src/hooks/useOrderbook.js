// ─── useOrderbook React Hook ─────────────────────────────────────────────────
//
// Wraps the Trystero P2P orderbook in React lifecycle.
// Order broadcast: Trystero (sell-orders, buy-orders, sync-req)
// Accept communication: XMTP 1:1 DM (accept-req, accept-res)
//
// Provides state: sellOrders, buyOrders, acceptRequests, peerCount, connected
// Provides actions: postSellOrder, postBuyOrder, requestAccept, respondAccept
//
// v2 개선:
//   - Trystero 자동 재연결 + 지수 백오프 (최대 60초)
//   - XMTP 스트림 에러 시 자동 재시작
//   - XMTP 하트비트: 30초마다 conversations.sync() 로 스트림 생존 확인

import { useEffect, useRef, useState, useCallback } from 'react'
import { createOrderbookRoom } from '../lib/trystero-orderbook.js'
import { isOrderExpired } from '../types/order.js'
import { verifyAcceptRequest } from '../lib/signature.js'
import { deleteExpiredOrders, getAllOrders, deleteOrder } from '../lib/indexeddb.js'
import { IdentifierKind, SortDirection, GroupMessageKind } from '@xmtp/browser-sdk'
import { useXmtp } from '../contexts/XmtpContext.jsx'

// Cleanup interval for expired orders (30 seconds)
const CLEANUP_INTERVAL_MS = 30_000

// 재연결 설정 (지수 백오프)
const RECONNECT_BASE_MS = 2_000   // 첫 재시도 대기
const RECONNECT_MAX_MS  = 60_000  // 최대 대기 (60초)
const RECONNECT_FACTOR  = 2       // 배율

// XMTP 하트비트 주기
const XMTP_HEARTBEAT_MS = 30_000  // 30초마다 sync 확인

// XMTP message envelope type prefix for accept messages
const ACCEPT_REQ_TYPE    = 'miniswap:accept-req'
const ACCEPT_RES_TYPE    = 'miniswap:accept-res'
const TRADE_CREATED_TYPE = 'miniswap:trade-created'

/** 지수 백오프 다음 딜레이 계산 */
function nextDelay(current) {
  return Math.min(current * RECONNECT_FACTOR, RECONNECT_MAX_MS)
}

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

  const roomRef        = useRef(null)
  const peersRef       = useRef(new Set())
  const sellOrdersRef  = useRef(sellOrders)
  const xmtpStreamRef  = useRef(null)
  const retryDelayRef  = useRef(RECONNECT_BASE_MS)
  const retryTimerRef  = useRef(null)
  const cancelledRef   = useRef(false)

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

  // ── Connect to P2P orderbook room — 자동 재연결 + 지수 백오프 ───────────

  useEffect(() => {
    if (!enabled) return

    cancelledRef.current = false

    async function connect() {
      if (cancelledRef.current) return

      try {
        const room = await createOrderbookRoom()
        if (cancelledRef.current) {
          room.leave()
          return
        }

        roomRef.current = room
        retryDelayRef.current = RECONNECT_BASE_MS  // 성공 시 딜레이 리셋

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

        room.onCancelOrder((orderId) => {
          setSellOrders(prev => prev.filter(o => o.id !== orderId))
          setBuyOrders(prev  => prev.filter(o => o.id !== orderId))
          setAcceptRequests(prev => prev.filter(r => r.orderId !== orderId))
          deleteOrder(orderId).catch(() => {})
        })

        room.onPeerJoin((peerId) => {
          // 피어가 들어오면 재연결 타이머 취소 (중복 room 생성 방지)
          clearTimeout(retryTimerRef.current)
          peersRef.current.add(peerId)
          setPeerCount(peersRef.current.size)
        })

        room.onPeerLeave((peerId) => {
          peersRef.current.delete(peerId)
          setPeerCount(peersRef.current.size)

          // 모든 피어가 떠났을 때만 재연결 시도
          if (peersRef.current.size === 0 && !cancelledRef.current) {
            scheduleReconnect()
          }
        })

      } catch (err) {
        if (cancelledRef.current) return
        console.warn(`[useOrderbook] 연결 실패, ${retryDelayRef.current / 1000}초 후 재시도:`, err)
        scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (cancelledRef.current) return
      const delay = retryDelayRef.current
      retryDelayRef.current = nextDelay(delay)

      retryTimerRef.current = setTimeout(() => {
        if (cancelledRef.current) return
        if (roomRef.current) {
          roomRef.current.leave()
          roomRef.current = null
        }
        peersRef.current.clear()
        setPeerCount(0)
        connect()
      }, delay)
    }

    connect()

    return () => {
      cancelledRef.current = true
      clearTimeout(retryTimerRef.current)
      if (roomRef.current) {
        roomRef.current.leave()
        roomRef.current = null
      }
      peersRef.current.clear()
      setPeerCount(0)
    }
  }, [enabled])

  // ── Stream XMTP DMs — 에러 시 자동 재시작 + 하트비트 ────────────────────

  useEffect(() => {
    if (!enabled || !xmtpReady || !xmtpClient) return

    let streamCancelled = false
    let xmtpRetryDelay  = RECONNECT_BASE_MS
    let xmtpRetryTimer  = null
    let heartbeatTimer  = null

    async function startAcceptStream() {
      if (streamCancelled) return

      // 이전 스트림 정리
      if (xmtpStreamRef.current) {
        try { xmtpStreamRef.current.end() } catch {}
        xmtpStreamRef.current = null
      }

      try {
        await xmtpClient.conversations.sync()
        if (streamCancelled) return

        const dms = await xmtpClient.conversations.listDms()
        if (streamCancelled) return

        for (const dm of dms) {
          await dm.sync()
          const msgs = await dm.messages({ direction: SortDirection.Ascending })
          for (const msg of msgs) {
            if (msg.kind !== GroupMessageKind.Application) continue
            handleAcceptMessage(msg)
          }
        }

        const stream = await xmtpClient.conversations.streamAllDmMessages()
        if (streamCancelled) {
          stream.end()
          return
        }
        xmtpStreamRef.current = stream
        xmtpRetryDelay = RECONNECT_BASE_MS  // 성공 시 딜레이 리셋

        // ── 하트비트: 30초마다 sync 로 스트림 생존 확인 ───────────────
        heartbeatTimer = setInterval(async () => {
          if (streamCancelled) return
          try {
            await xmtpClient.conversations.sync()
          } catch (err) {
            console.warn('[useOrderbook] XMTP 하트비트 실패, 스트림 재시작:', err)
            clearInterval(heartbeatTimer)
            scheduleXmtpRestart()
          }
        }, XMTP_HEARTBEAT_MS)

        for await (const msg of stream) {
          if (streamCancelled) break
          if (msg.kind !== GroupMessageKind.Application) continue
          if (msg.senderInboxId === xmtpClient.inboxId) continue
          handleAcceptMessage(msg)
        }

      } catch (err) {
        if (streamCancelled) return
        console.warn(`[useOrderbook] XMTP 스트림 오류, ${xmtpRetryDelay / 1000}초 후 재시작:`, err)
        clearInterval(heartbeatTimer)
        scheduleXmtpRestart()
      }
    }

    function scheduleXmtpRestart() {
      if (streamCancelled) return
      const delay = xmtpRetryDelay
      xmtpRetryDelay = nextDelay(delay)
      xmtpRetryTimer = setTimeout(() => startAcceptStream(), delay)
    }

    function handleAcceptMessage(msg) {
      try {
        const envelope = JSON.parse(msg.content)

        if (envelope.type === ACCEPT_REQ_TYPE) {
          const req = envelope.payload
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
      streamCancelled = true
      clearTimeout(xmtpRetryTimer)
      clearInterval(heartbeatTimer)
      if (xmtpStreamRef.current) {
        try { xmtpStreamRef.current.end() } catch {}
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
   * 내 오더 취소: 로컬 상태 제거 + IndexedDB 삭제 + 피어에게 취소 브로드캐스트
   */
  const cancelOrder = useCallback((orderId) => {
    setSellOrders(prev => prev.filter(o => o.id !== orderId))
    setBuyOrders(prev  => prev.filter(o => o.id !== orderId))
    setAcceptRequests(prev => prev.filter(r => r.orderId !== orderId))
    deleteOrder(orderId).catch(() => {})
    if (roomRef.current) {
      roomRef.current.broadcastCancelOrder(orderId)
    }
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
    cancelOrder,
  }
}
