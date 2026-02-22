import { useEffect, useRef, useState, useCallback } from 'react'

const APP_ID = 'miniswap-p2p-v1'

// Public Nostr relays — used for WebRTC signaling only (no trade data stored)
const NOSTR_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
]

/**
 * P2P room hook using Trystero/Nostr for signaling.
 *
 * @param {string|null} roomId  - The trade ID to use as room key
 * @param {boolean}     enabled - Whether to connect (default true)
 * @returns {{ peers, messages, send, connected }}
 */
export function useP2P(roomId, enabled = true) {
  const [peers,    setPeers]    = useState([])
  const [messages, setMessages] = useState([])
  const roomRef    = useRef(null)
  const sendMsgRef = useRef(null)

  useEffect(() => {
    if (!roomId || !enabled) return

    let cancelled = false

    // Lazy-import trystero/nostr to avoid SSR issues
    import('trystero/nostr').then(({ joinRoom }) => {
      if (cancelled) return

      const room = joinRoom(
        { appId: APP_ID, relayUrls: NOSTR_RELAYS },
        roomId
      )
      roomRef.current = room

      const [sendMsg, receiveMsg] = room.makeAction('msg')
      sendMsgRef.current = sendMsg

      receiveMsg((data, peerId) => {
        setMessages(prev => [...prev, {
          id:       `${Date.now()}-${Math.random()}`,
          ...data,
          fromMe:   false,
          peerId,
          timestamp: data.timestamp ?? Date.now(),
        }])
      })

      room.onPeerJoin(peerId => {
        setPeers(prev => [...new Set([...prev, peerId])])
        setMessages(prev => [...prev, {
          id:        `sys-join-${peerId}-${Date.now()}`,
          type:      'sys',
          text:      '상대방이 연결되었습니다',
          fromMe:    false,
          timestamp: Date.now(),
        }])
      })

      room.onPeerLeave(peerId => {
        setPeers(prev => prev.filter(p => p !== peerId))
        setMessages(prev => [...prev, {
          id:        `sys-leave-${peerId}-${Date.now()}`,
          type:      'sys',
          text:      '상대방 연결이 끊겼습니다',
          fromMe:    false,
          timestamp: Date.now(),
        }])
      })
    }).catch(err => {
      console.warn('[useP2P] Failed to load trystero/nostr:', err)
    })

    return () => {
      cancelled = true
      if (roomRef.current) {
        try { roomRef.current.leave() } catch {}
        roomRef.current  = null
        sendMsgRef.current = null
      }
      setPeers([])
    }
  }, [roomId, enabled])

  const send = useCallback((data) => {
    const msg = {
      id:        `me-${Date.now()}`,
      ...data,
      timestamp: Date.now(),
      fromMe:    true,
    }
    setMessages(prev => [...prev, msg])

    if (sendMsgRef.current) {
      try {
        sendMsgRef.current({
          ...data,
          timestamp: msg.timestamp,
        })
      } catch (err) {
        console.warn('[useP2P] send failed:', err)
      }
    }
  }, [])

  return {
    peers,
    messages,
    send,
    connected: peers.length > 0,
  }
}
