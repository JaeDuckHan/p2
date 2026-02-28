// ─── Order signature & verification ──────────────────────────────────────────
//
// Signs order fields using:
//   - EVM: EIP-191 personal_sign via ethers.js
//   - Tron: TronWeb signMessageV2
//
// This prevents order forgery on the P2P network.
//
// API:
//   signOrder(signer, order, { chainType })
//   verifyOrder(order)
//   signAcceptRequest(signer, orderId, address, { chainType })
//   verifyAcceptRequest(orderId, address, signature)

import { ethers } from 'ethers'

// ── Tron 서명 헬퍼 ────────────────────────────────────────────────────────────

function getTronWeb() {
  if (typeof window !== 'undefined' && window.tronWeb?.ready) return window.tronWeb
  return null
}

/**
 * Tron 주소를 hex 형태로 변환 (TronWeb 필요).
 * 비교용으로만 사용.
 */
function tronAddressToHex(addr) {
  const tw = getTronWeb()
  if (tw?.address?.toHex) return tw.address.toHex(addr).toLowerCase()
  return addr.toLowerCase()
}

// ── 공통: 주문 메시지 문자열 빌드 ────────────────────────────────────────────

/**
 * Build a deterministic message string for signing.
 * Same across EVM/Tron to ensure cross-chain verify compatibility.
 */
function buildOrderMessage(order) {
  const amountScaled = Math.round(order.amount * 1e6)
  const priceScaled  = Math.round(order.priceKRW)
  return `miniswap:order:${order.id}:${amountScaled}:${priceScaled}:${order.expiry}`
}

function buildAcceptMessage(orderId, address) {
  return `miniswap:accept:${orderId}:${address}`
}

// ── EVM 서명/검증 ─────────────────────────────────────────────────────────────

function buildOrderHashEvm(order) {
  const amountScaled = Math.round(order.amount * 1e6)
  const priceScaled  = Math.round(order.priceKRW)

  const hash = ethers.solidityPackedKeccak256(
    ['string',  'uint256',    'uint256',    'uint256'],
    [order.id,  amountScaled, priceScaled,  order.expiry]
  )
  return ethers.getBytes(hash)
}

async function signOrderEvm(signer, order) {
  const messageBytes = buildOrderHashEvm(order)
  const signature = await signer.signMessage(messageBytes)
  return { ...order, signature }
}

function verifyOrderEvm(order) {
  const messageBytes = buildOrderHashEvm(order)
  const recovered = ethers.verifyMessage(messageBytes, order.signature)

  const expectedOwner = order.type === 'SELL' ? order.seller : order.buyer
  if (recovered.toLowerCase() !== expectedOwner.toLowerCase()) {
    return {
      valid: false,
      recovered,
      reason: `Signer mismatch: expected ${expectedOwner}, got ${recovered}`,
    }
  }
  return { valid: true, recovered }
}

async function signAcceptEvm(signer, orderId, buyerAddress) {
  const hash = ethers.solidityPackedKeccak256(
    ['string',  'string', 'address'],
    ['accept',  orderId,  buyerAddress]
  )
  return signer.signMessage(ethers.getBytes(hash))
}

function verifyAcceptEvm(orderId, buyerAddress, signature) {
  const hash = ethers.solidityPackedKeccak256(
    ['string',  'string', 'address'],
    ['accept',  orderId,  buyerAddress]
  )
  const recovered = ethers.verifyMessage(ethers.getBytes(hash), signature)
  if (recovered.toLowerCase() !== buyerAddress.toLowerCase()) {
    return { valid: false, reason: 'Signer does not match buyer address' }
  }
  return { valid: true }
}

// ── Tron 서명/검증 ────────────────────────────────────────────────────────────

async function signOrderTron(_signer, order) {
  const tw = getTronWeb()
  if (!tw) throw new Error('TronWeb not available')

  const message = buildOrderMessage(order)
  const signature = await tw.trx.signMessageV2(message)
  return { ...order, signature }
}

function verifyOrderTron(order) {
  const tw = getTronWeb()
  if (!tw) return { valid: false, reason: 'TronWeb not available for verification' }

  const message = buildOrderMessage(order)
  const recovered = tw.trx.verifyMessageV2(message, order.signature)

  const expectedOwner = order.type === 'SELL' ? order.seller : order.buyer
  if (tronAddressToHex(recovered) !== tronAddressToHex(expectedOwner)) {
    return {
      valid: false,
      recovered,
      reason: `Signer mismatch: expected ${expectedOwner}, got ${recovered}`,
    }
  }
  return { valid: true, recovered }
}

async function signAcceptTron(_signer, orderId, address) {
  const tw = getTronWeb()
  if (!tw) throw new Error('TronWeb not available')

  const message = buildAcceptMessage(orderId, address)
  return tw.trx.signMessageV2(message)
}

function verifyAcceptTron(orderId, address, signature) {
  const tw = getTronWeb()
  if (!tw) return { valid: false, reason: 'TronWeb not available for verification' }

  const message = buildAcceptMessage(orderId, address)
  const recovered = tw.trx.verifyMessageV2(message, signature)
  if (tronAddressToHex(recovered) !== tronAddressToHex(address)) {
    return { valid: false, reason: 'Signer does not match address' }
  }
  return { valid: true }
}

// ── Public API (chainType 명시형) ─────────────────────────────────────────────

/**
 * Detect chain type from the order's owner address.
 * @param {import('../types/order.js').Order} order
 * @returns {'evm'|'tron'}
 */
function detectChainType(order) {
  const owner = order.type === 'SELL' ? order.seller : order.buyer
  if (owner && owner.startsWith('T') && !owner.startsWith('0x')) return 'tron'
  return 'evm'
}

/**
 * Sign an order using the connected wallet.
 *
 * @param {import('ethers').Signer|null} signer - ethers Signer (EVM) or null (Tron)
 * @param {import('../types/order.js').Order} order
 * @param {{ chainType?: 'evm'|'tron' }} [options]
 * @returns {Promise<import('../types/order.js').Order>} Signed order
 */
export async function signOrder(signer, order, options = {}) {
  const chainType = options.chainType || detectChainType(order)
  if (chainType === 'tron') return signOrderTron(signer, order)
  return signOrderEvm(signer, order)
}

/**
 * Verify that an order's signature matches its claimed owner.
 * Auto-detects chain type from address format.
 *
 * @param {import('../types/order.js').Order} order
 * @returns {{ valid: boolean, recovered?: string, reason?: string }}
 */
export function verifyOrder(order) {
  if (!order.signature) {
    return { valid: false, reason: 'No signature present' }
  }

  try {
    const chainType = detectChainType(order)
    if (chainType === 'tron') return verifyOrderTron(order)
    return verifyOrderEvm(order)
  } catch (err) {
    return { valid: false, reason: `Verification error: ${err.message}` }
  }
}

/**
 * Sign an accept request (buyer proves intent to accept an order).
 *
 * @param {import('ethers').Signer|null} signer
 * @param {string} orderId
 * @param {string} address
 * @param {{ chainType?: 'evm'|'tron' }} [options]
 * @returns {Promise<string>} signature
 */
export async function signAcceptRequest(signer, orderId, address, options = {}) {
  const chainType = options.chainType || (address.startsWith('T') && !address.startsWith('0x') ? 'tron' : 'evm')
  if (chainType === 'tron') return signAcceptTron(signer, orderId, address)
  return signAcceptEvm(signer, orderId, address)
}

/**
 * Verify an accept request signature.
 * Auto-detects chain type from address format.
 *
 * @param {string} orderId
 * @param {string} address
 * @param {string} signature
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verifyAcceptRequest(orderId, address, signature) {
  try {
    const isTron = address.startsWith('T') && !address.startsWith('0x')
    if (isTron) return verifyAcceptTron(orderId, address, signature)
    return verifyAcceptEvm(orderId, address, signature)
  } catch (err) {
    return { valid: false, reason: `Verification error: ${err.message}` }
  }
}
