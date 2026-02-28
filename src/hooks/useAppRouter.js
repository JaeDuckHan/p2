/**
 * useAppRouter — 앱 화면 결정 훅
 *
 * 지갑 연결 상태, 네트워크, 진행 중 거래 등을 기반으로
 * 현재 표시할 화면(view)을 결정한다.
 *
 * 반환값: 'loading' | 'hero' | 'network' | 'trade-room' | 'create-trade' | 'home'
 */
export function useAppRouter({ status, isConnected, wrongNetwork, activeTrade, createTradeOptions }) {
  if (status === 'reconnecting') return 'loading'
  if (!isConnected)              return 'hero'
  if (wrongNetwork)              return 'network'
  if (activeTrade?.tradeId)      return 'trade-room'
  if (createTradeOptions)        return 'create-trade'
  return 'home'
}
