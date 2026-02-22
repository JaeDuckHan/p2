// ─── MetaMask order signature & verification ─────────────────────────────────
//
// Signs order fields using EIP-191 personal_sign via ethers.js.
// This prevents order forgery on the P2P network.

import { ethers } from 'ethers'

/**
 * Build the message hash for an order.
 * Uses solidityPackedKeccak256 over core order fields.
 *
 * @param {import('../types/order.js').Order} order
 * @returns {Uint8Array} The raw bytes to sign
 */
function buildOrderHash(order) {
  // Convert amount and priceKRW to integers for deterministic hashing.
  // amount is in USDT (up to 6 decimals), priceKRW is integer KRW.
  const amountScaled = Math.round(order.amount * 1e6)
  const priceScaled  = Math.round(order.priceKRW)

  const hash = ethers.solidityPackedKeccak256(
    ['string',  'uint256',    'uint256',    'uint256'],
    [order.id,  amountScaled, priceScaled,  order.expiry]
  )
  return ethers.getBytes(hash)
}

/**
 * Sign an order using the connected wallet (MetaMask).
 * Returns the order with the `signature` field populated.
 *
 * @param {import('ethers').Signer} signer - ethers Signer from wallet
 * @param {import('../types/order.js').Order} order - Order to sign (signature field will be overwritten)
 * @returns {Promise<import('../types/order.js').Order>} Signed order
 */
export async function signOrder(signer, order) {
  const messageBytes = buildOrderHash(order)
  const signature = await signer.signMessage(messageBytes)
  return { ...order, signature }
}

/**
 * Verify that an order's signature matches its claimed owner.
 *
 * @param {import('../types/order.js').Order} order - Order with signature
 * @returns {{ valid: boolean, recovered?: string, reason?: string }}
 */
export function verifyOrder(order) {
  if (!order.signature) {
    return { valid: false, reason: 'No signature present' }
  }

  try {
    const messageBytes = buildOrderHash(order)
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
  } catch (err) {
    return { valid: false, reason: `Verification error: ${err.message}` }
  }
}

/**
 * Sign an accept request (buyer proves intent to accept an order).
 *
 * @param {import('ethers').Signer} signer
 * @param {string} orderId
 * @param {string} buyerAddress
 * @returns {Promise<string>} signature
 */
export async function signAcceptRequest(signer, orderId, buyerAddress) {
  const hash = ethers.solidityPackedKeccak256(
    ['string',  'string', 'address'],
    ['accept',  orderId,  buyerAddress]
  )
  return signer.signMessage(ethers.getBytes(hash))
}

/**
 * Verify an accept request signature.
 *
 * @param {string} orderId
 * @param {string} buyerAddress
 * @param {string} signature
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verifyAcceptRequest(orderId, buyerAddress, signature) {
  try {
    const hash = ethers.solidityPackedKeccak256(
      ['string',  'string', 'address'],
      ['accept',  orderId,  buyerAddress]
    )
    const recovered = ethers.verifyMessage(ethers.getBytes(hash), signature)
    if (recovered.toLowerCase() !== buyerAddress.toLowerCase()) {
      return { valid: false, reason: 'Signer does not match buyer address' }
    }
    return { valid: true }
  } catch (err) {
    return { valid: false, reason: `Verification error: ${err.message}` }
  }
}
