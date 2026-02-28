/**
 * amount.js — USDT 금액 변환 공용 유틸 (BigInt 기반)
 *
 * JS Number를 사용하지 않고 BigInt 기반으로 정밀 변환한다.
 * EVM(6 decimals), Tron(6 decimals) 모두 이 유틸을 통해 처리한다.
 */

/**
 * 소수 문자열을 BigInt 정수로 변환한다.
 * 예: parseAmount("1.23", 6) → 1230000n
 *
 * @param {string} str - 소수점 포함 금액 문자열 (예: "100.5")
 * @param {number} [decimals=6] - 소수 자릿수
 * @returns {bigint} 정수화된 금액
 */
export function parseAmount(str, decimals = 6) {
  if (!str || typeof str !== 'string') return 0n
  const trimmed = str.trim()
  if (trimmed === '' || trimmed === '.') return 0n

  try {
    const [intPart = '0', fracPart = ''] = trimmed.split('.')
    // 소수 부분을 decimals 자리까지 패딩/자르기
    const paddedFrac = fracPart.slice(0, decimals).padEnd(decimals, '0')
    const combined = intPart + paddedFrac
    // 선행 0 제거 후 BigInt 변환
    const cleaned = combined.replace(/^0+/, '') || '0'
    return BigInt(cleaned)
  } catch {
    return 0n
  }
}

/**
 * BigInt 정수를 소수 문자열로 변환한다.
 * 예: formatAmount(1230000n, 6) → "1.23"
 *
 * @param {bigint|string|number|undefined|null} raw - 정수화된 금액
 * @param {number} [decimals=6] - 소수 자릿수
 * @returns {string} 소수점 포함 금액 문자열
 */
export function formatAmount(raw, decimals = 6) {
  if (raw === undefined || raw === null) return '—'

  let value
  try {
    value = BigInt(raw)
  } catch {
    return '—'
  }

  const isNegative = value < 0n
  if (isNegative) value = -value

  const divisor = 10n ** BigInt(decimals)
  const intPart = value / divisor
  const fracPart = value % divisor

  const fracStr = fracPart.toString().padStart(decimals, '0')
  // 후행 0 제거
  const trimmedFrac = fracStr.replace(/0+$/, '')

  const sign = isNegative ? '-' : ''
  if (trimmedFrac === '') return `${sign}${intPart}`
  return `${sign}${intPart}.${trimmedFrac}`
}
