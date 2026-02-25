// ─── useXmtpChat Hook ─────────────────────────────────────────────────────────
//
// Replaces useP2P for trade chat. Uses XMTP 1:1 DM instead of Trystero WebRTC.
// Supports offline message delivery — messages are stored by XMTP network nodes.
//
// Interface: same as useP2P — { peers, messages, send, connected }
//
// v2 개선:
//   - 스트림 에러 시 자동 재시작 + 지수 백오프 (최대 60초)
//   - 하트비트: 30초마다 conversation.sync() 로 스트림 생존 확인

import { useEffect, useRef, useState, useCallback } from 'react'
import { IdentifierKind, SortDirection, GroupMessageKind } from '@xmtp/browser-sdk'
import { useXmtp } from '../contexts/XmtpContext'

const RECONNECT_BASE_MS  = 2_000
const RECONNECT_MAX_MS   = 60_000
const RECONNECT_FACTOR   = 2
const CHAT_HEARTBEAT_MS  = 30_000  // 30초마다 스트림 생존 확인

function nextDelay(current) {
  return Math.min(current * RECONNECT_FACTOR, RECONNECT_MAX_MS)
}

/**
 * XMTP-based trade chat hook.
 *
 * @param {string|null} peerAddress  - Counterparty wallet address (0x...)
 * @param {string|null} tradeId     - Trade ID (used to tag/filter messages)
 * @param {boolean}     enabled     - Whether to connect
 * @returns {{ peers: string[], messages: Array, send: function, connected: boolean }}
 */
export function useXmtpChat(peerAddress, tradeId, enabled = true) {
  const { client, isReady } = useXmtp()
  const [messages, setMessages] = useState([])
  const [connected, setConnected] = useState(false)

  const conversationRef = useRef(null)
  const streamRef       = useRef(null)
  const retryDelayRef   = useRef(RECONNECT_BASE_MS)

  // ── Initialize conversation & load history — 자동 재시작 + 하트비트 ──────

  useEffect(() => {
    if (!isReady || !client || !peerAddress || !tradeId || !enabled) return

    let cancelled      = false
    let heartbeatTimer = null
    let retryTimer     = null

    async function init() {
      if (cancelled) return

      // 이전 스트림 정리
      if (streamRef.current) {
        try { streamRef.current.end() } catch {}
        streamRef.current = null
      }

      try {
        const conversation = await client.conversations.createDmWithIdentifier({
          identifier: peerAddress.toLowerCase(),
          identifierKind: IdentifierKind.Ethereum,
        })
        if (cancelled) return
        conversationRef.current = conversation

        await conversation.sync()
        if (cancelled) return

        const existing = await conversation.messages({
          direction: SortDirection.Ascending,
        })
        if (cancelled) return

        const parsed = []
        for (const msg of existing) {
          if (msg.kind !== GroupMessageKind.Application) continue
          try {
            const data = JSON.parse(msg.content)
            if (data.tradeId !== tradeId) continue
            parsed.push({
              ...data,
              id: data.id || msg.id,
              fromMe: msg.senderInboxId === client.inboxId,
            })
          } catch {
            // Skip non-JSON messages
          }
        }

        setMessages(parsed)
        setConnected(true)
        retryDelayRef.current = RECONNECT_BASE_MS  // 성공 시 리셋

        const stream = await conversation.stream()
        if (cancelled) {
          stream.end()
          return
        }
        streamRef.current = stream

        // ── 하트비트: 30초마다 conversation.sync() 로 스트림 생존 확인 ──
        heartbeatTimer = setInterval(async () => {
          if (cancelled) return
          try {
            await conversation.sync()
          } catch (err) {
            console.warn('[useXmtpChat] 하트비트 실패, 스트림 재시작:', err)
            clearInterval(heartbeatTimer)
            setConnected(false)
            scheduleRestart()
          }
        }, CHAT_HEARTBEAT_MS)

        for await (const msg of stream) {
          if (cancelled) break
          if (msg.kind !== GroupMessageKind.Application) continue
          if (msg.senderInboxId === client.inboxId) continue
          try {
            const data = JSON.parse(msg.content)
            if (data.tradeId !== tradeId) continue
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev
              return [...prev, { ...data, id: data.id || msg.id, fromMe: false }]
            })
          } catch {
            // Skip non-JSON
          }
        }

      } catch (err) {
        if (cancelled) return
        console.warn(`[useXmtpChat] 초기화 실패, ${retryDelayRef.current / 1000}초 후 재시도:`, err)
        setConnected(false)
        clearInterval(heartbeatTimer)
        scheduleRestart()
      }
    }

    function scheduleRestart() {
      if (cancelled) return
      const delay = retryDelayRef.current
      retryDelayRef.current = nextDelay(delay)
      retryTimer = setTimeout(() => init(), delay)
    }

    init()

    return () => {
      cancelled = true
      clearInterval(heartbeatTimer)
      clearTimeout(retryTimer)
      if (streamRef.current) {
        try { streamRef.current.end() } catch {}
        streamRef.current = null
      }
      conversationRef.current = null
    }
  }, [client, isReady, peerAddress, tradeId, enabled])

  // ── Send message ────────────────────────────────────────────────────────

  const send = useCallback(
    (data) => {
      if (!conversationRef.current || !client) return

      const msg = {
        id: `me-${Date.now()}`,
        ...data,
        tradeId,
        sender: client.accountIdentifier?.identifier,
        timestamp: Date.now(),
      }

      // Optimistic local update
      setMessages((prev) => [...prev, { ...msg, fromMe: true }])

      // Send as JSON text via XMTP
      const { fromMe, ...payload } = msg
      conversationRef.current.sendText(JSON.stringify(payload)).catch((err) => {
        console.warn('[useXmtpChat] send failed:', err)
      })
    },
    [tradeId, client]
  )

  return {
    peers: connected ? [peerAddress] : [],
    messages,
    send,
    connected,
  }
}
