// ─── useXmtpChat Hook ─────────────────────────────────────────────────────────
//
// Replaces useP2P for trade chat. Uses XMTP 1:1 DM instead of Trystero WebRTC.
// Supports offline message delivery — messages are stored by XMTP network nodes.
//
// Interface: same as useP2P — { peers, messages, send, connected }

import { useEffect, useRef, useState, useCallback } from 'react'
import { IdentifierKind, SortDirection, GroupMessageKind } from '@xmtp/browser-sdk'
import { useXmtp } from '../contexts/XmtpContext'

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
  const streamRef = useRef(null)

  // ── Initialize conversation & load history ──────────────────────────────

  useEffect(() => {
    if (!isReady || !client || !peerAddress || !tradeId || !enabled) return

    let cancelled = false

    async function init() {
      try {
        // Create or get existing DM with peer
        const conversation = await client.conversations.createDmWithIdentifier({
          identifier: peerAddress.toLowerCase(),
          identifierKind: IdentifierKind.Ethereum,
        })
        if (cancelled) return
        conversationRef.current = conversation

        // Sync to get latest messages from network
        await conversation.sync()
        if (cancelled) return

        // Load existing messages and filter by tradeId
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

        // Stream new incoming messages
        const stream = await conversation.stream()
        if (cancelled) {
          stream.end()
          return
        }
        streamRef.current = stream

        for await (const msg of stream) {
          if (cancelled) break
          if (msg.kind !== GroupMessageKind.Application) continue
          if (msg.senderInboxId === client.inboxId) continue // skip own
          try {
            const data = JSON.parse(msg.content)
            if (data.tradeId !== tradeId) continue
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev
              return [
                ...prev,
                {
                  ...data,
                  id: data.id || msg.id,
                  fromMe: false,
                },
              ]
            })
          } catch {
            // Skip non-JSON
          }
        }
      } catch (err) {
        console.warn('[useXmtpChat] init failed:', err)
      }
    }

    init()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.end()
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
