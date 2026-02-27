/**
 * utils — 공통 유틸리티 함수
 * cn(): clsx로 조건부 클래스 문자열을 생성하고, tailwind-merge로 Tailwind 충돌 클래스를 병합합니다.
 */

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind 클래스를 안전하게 병합하는 유틸리티 함수
 * clsx로 falsy 값/배열/객체를 처리하고, twMerge로 중복 유틸리티를 최종 병합합니다.
 * @param {...(string|undefined|null|boolean|Object)} inputs - 병합할 클래스 값들
 * @returns {string} 병합된 클래스 문자열
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
