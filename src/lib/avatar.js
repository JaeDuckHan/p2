/**
 * avatar — 아바타 유틸리티
 * 지갑 주소를 기반으로 결정론적 그라디언트 배경색과 이니셜 문자를 생성합니다.
 * 같은 주소는 항상 동일한 색상과 문자를 반환합니다.
 */

// 아바타에 사용할 그라디언트 팔레트 (6가지)
const GRADIENTS = [
  'linear-gradient(135deg, #00F5A0 0%, #00D9F5 100%)',
  'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)',
  'linear-gradient(135deg, #00b894 0%, #55efc4 100%)',
  'linear-gradient(135deg, #e17055 0%, #fab1a0 100%)',
  'linear-gradient(135deg, #0984e3 0%, #74b9ff 100%)',
  'linear-gradient(135deg, #fdcb6e 0%, #f39c12 100%)',
]

/**
 * 지갑 주소의 마지막 4자리 hex 값을 인덱스로 변환하여 그라디언트를 반환
 * @param {string} addr - 이더리움 지갑 주소
 * @returns {string} CSS linear-gradient 문자열
 */
export function getAvatarGradient(addr) {
  if (!addr) return GRADIENTS[0]
  // 주소 마지막 4자리를 16진수로 파싱 후 팔레트 수로 나눈 나머지를 인덱스로 사용
  const idx = parseInt(addr.slice(-4), 16) % GRADIENTS.length
  return GRADIENTS[idx]
}

/**
 * 지갑 주소에서 아바타 이니셜 문자 2자리를 추출 (0x 접두사 제외 첫 2자리)
 * @param {string} addr - 이더리움 지갑 주소
 * @returns {string} 대문자 2자리 문자열
 */
export function getAvatarChar(addr) {
  if (!addr) return '?'
  return addr.slice(2, 4).toUpperCase()
}
