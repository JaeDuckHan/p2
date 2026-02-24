/**
 * mockData.js — Mock 데이터 모음
 *
 * UI 코드에서 직접 하드코딩하지 않고, 여기에서 관리.
 * 실제 온체인/IndexedDB 데이터가 준비되면 이 파일의 값 대신 실제 값을 사용.
 */

// TODO: 실제 온체인 API 연동 필요 — IndexedDB 평판 시스템 연동 시 교체
export const MOCK_RATING = {
  score: 5.0,
  stars: '\u2605\u2605\u2605\u2605\u2605',
  tradeCount: 0,
}

/**
 * 사용자 주소 기반 평판 데이터를 반환.
 * realData가 있으면 실제 데이터, 없으면 mock 데이터를 리턴.
 *
 * @param {string} address - 사용자 지갑 주소
 * @param {object|null} realData - 실제 평판 데이터 (온체인/IndexedDB)
 * @returns {{ score: number, stars: string, tradeCount: number }}
 */
// TODO: 실제 온체인 API 연동 필요 — useReputation 훅 완성 후 realData 파라미터 활용
export function getUserRating(address, realData = null) {
  if (realData) {
    return {
      score: realData.score ?? MOCK_RATING.score,
      stars: getStarsString(realData.score ?? MOCK_RATING.score),
      tradeCount: realData.tradeCount ?? MOCK_RATING.tradeCount,
    }
  }
  return { ...MOCK_RATING }
}

/**
 * 숫자 점수를 별 문자열로 변환
 * @param {number} score - 0~5 범위의 평점
 * @returns {string} 별 문자열 (예: "★★★★☆")
 */
export function getStarsString(score) {
  const full = Math.floor(score)
  const empty = 5 - full
  return '\u2605'.repeat(full) + '\u2606'.repeat(empty)
}

/**
 * 별점 + 거래횟수를 표시하는 포맷 문자열
 * @param {object} rating - getUserRating()이 리턴한 객체
 * @returns {string} "★★★★★ 5.0 · 거래 127회" 형태
 */
export function formatRatingDisplay(rating) {
  const countStr = rating.tradeCount > 0 ? ` \u00B7 거래 ${rating.tradeCount}회` : ''
  return `${rating.stars} ${rating.score.toFixed(1)}${countStr}`
}
