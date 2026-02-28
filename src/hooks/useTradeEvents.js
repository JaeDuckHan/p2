/**
 * useTradeEvents — 거래 이벤트 리스너 훅
 *
 * App.jsx에서 분리된 두 가지 이벤트 처리를 캡슐화한다:
 *   1. miniswap:accept-req 커스텀 이벤트 → orderbook.requestAccept 중계
 *   2. tradeNotifications 감시 → 구매자 자동 거래방 이동
 */
import { useEffect } from 'react'

export function useTradeEvents({ orderbook, address, activeTrade, setActiveTrade }) {
  /**
   * OrderDetail 컴포넌트에서 발생하는 'miniswap:accept-req' 커스텀 이벤트를 감지해
   * orderbook.requestAccept()로 수락 요청을 전달한다.
   */
  useEffect(() => {
    function handleAcceptReq(e) {
      orderbook.requestAccept(e.detail)
    }
    window.addEventListener('miniswap:accept-req', handleAcceptReq)
    return () => window.removeEventListener('miniswap:accept-req', handleAcceptReq)
  }, [orderbook.requestAccept])

  /**
   * 판매자가 에스크로를 생성하면 구매자를 자동으로 거래방으로 이동시킨다.
   * tradeNotifications에서 현재 지갑 주소가 buyer인 알림을 찾아 activeTrade를 설정한다.
   */
  useEffect(() => {
    if (!address || activeTrade?.tradeId) return
    const notif = orderbook.tradeNotifications.find(
      n => n.buyer?.toLowerCase() === address?.toLowerCase()
    )
    if (notif?.tradeId) {
      setActiveTrade({ tradeId: notif.tradeId, role: 'buyer' })
    }
  }, [orderbook.tradeNotifications, address, activeTrade])
}
