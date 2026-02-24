// TODO: 실제 온체인 API 연동 필요 — 현재는 목업 데이터
// 실제 데이터는 컨트랙트 이벤트 집계 또는 서브그래프에서 가져올 것

/**
 * Mock user profile data.
 * Replace with on-chain trade history aggregation.
 */
const MOCK_PROFILE = {
  rating: 5.0,
  stars: '★★★★★',
  tradeCount: 0,
  trustLevel: 'new', // 'new' | 'verified' | 'trusted'
}

/**
 * Get user profile (mock).
 * @param {string} address - wallet address
 * @param {object|null} realData - real on-chain data (when available)
 * @returns {{ rating: number, stars: string, tradeCount: number, trustLevel: string }}
 */
export function getUserProfile(address, realData = null) {
  // TODO: 실제 온체인 API 연동 필요
  if (realData) return realData
  return { ...MOCK_PROFILE }
}

/**
 * Render stars string from rating value.
 * @param {number} rating - 0 to 5
 * @returns {string}
 */
export function renderStars(rating) {
  const full = Math.floor(rating)
  const empty = 5 - full
  return '★'.repeat(full) + '☆'.repeat(empty)
}
