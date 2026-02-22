// ─── Order type definitions & utilities ──────────────────────────────────────

/**
 * @typedef {'SELL'|'BUY'} OrderType
 *
 * @typedef {Object} SellOrder
 * @property {string}  id          - Unique order ID (uuid-like)
 * @property {'SELL'}  type
 * @property {string}  seller      - 0x address
 * @property {number}  amount      - USDT quantity
 * @property {number}  priceKRW    - KRW per 1 USDT
 * @property {string}  bankAccount - Bank account info (shown only after accept)
 * @property {number}  expiry      - Unix timestamp (ms)
 * @property {string}  signature   - MetaMask personal_sign
 * @property {number}  createdAt   - Unix timestamp (ms)
 *
 * @typedef {Object} BuyOrder
 * @property {string}  id
 * @property {'BUY'}   type
 * @property {string}  buyer       - 0x address
 * @property {number}  amount      - Desired USDT quantity
 * @property {number}  priceKRW    - KRW per 1 USDT
 * @property {number}  expiry      - Unix timestamp (ms)
 * @property {string}  signature   - MetaMask personal_sign
 * @property {number}  createdAt   - Unix timestamp (ms)
 *
 * @typedef {SellOrder|BuyOrder} Order
 *
 * @typedef {Object} AcceptRequest
 * @property {string} orderId     - The order being accepted
 * @property {string} buyer       - 0x address of the requester
 * @property {number} timestamp   - When the request was made (ms)
 * @property {string} signature   - Signed proof of intent
 *
 * @typedef {Object} AcceptResponse
 * @property {string}  orderId
 * @property {string}  buyer      - Accepted buyer address
 * @property {boolean} accepted   - true = accepted, false = rejected
 * @property {string}  [bankAccount] - Revealed only on acceptance
 */

// Default expiry: 30 minutes from now
const DEFAULT_EXPIRY_MS = 30 * 60 * 1000

/**
 * Generate a unique order ID.
 * Format: `ord-<timestamp>-<random>`
 */
function generateOrderId() {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `ord-${ts}-${rand}`
}

/**
 * Create a sell order object (unsigned).
 *
 * @param {Object} params
 * @param {string} params.seller
 * @param {number} params.amount
 * @param {number} params.priceKRW
 * @param {string} params.bankAccount
 * @param {number} [params.expiryMs] - Duration in ms (default 30 min)
 * @returns {SellOrder}
 */
export function createSellOrder({ seller, amount, priceKRW, bankAccount, expiryMs }) {
  const now = Date.now()
  return {
    id: generateOrderId(),
    type: 'SELL',
    seller,
    amount,
    priceKRW,
    bankAccount,
    expiry: now + (expiryMs || DEFAULT_EXPIRY_MS),
    signature: '',  // filled after signing
    createdAt: now,
  }
}

/**
 * Create a buy order object (unsigned).
 *
 * @param {Object} params
 * @param {string} params.buyer
 * @param {number} params.amount
 * @param {number} params.priceKRW
 * @param {number} [params.expiryMs]
 * @returns {BuyOrder}
 */
export function createBuyOrder({ buyer, amount, priceKRW, expiryMs }) {
  const now = Date.now()
  return {
    id: generateOrderId(),
    type: 'BUY',
    buyer,
    amount,
    priceKRW,
    expiry: now + (expiryMs || DEFAULT_EXPIRY_MS),
    signature: '',
    createdAt: now,
  }
}

/**
 * Check whether an order has expired.
 * @param {Order} order
 * @returns {boolean}
 */
export function isOrderExpired(order) {
  return Date.now() > order.expiry
}

/**
 * Basic structural validation of an order.
 * Does NOT verify the cryptographic signature (use verifyOrder for that).
 *
 * @param {Order} order
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateOrder(order) {
  if (!order || typeof order !== 'object') {
    return { valid: false, reason: 'Order is not an object' }
  }
  if (order.type !== 'SELL' && order.type !== 'BUY') {
    return { valid: false, reason: `Invalid order type: ${order.type}` }
  }
  if (!order.id || typeof order.id !== 'string') {
    return { valid: false, reason: 'Missing order id' }
  }

  const owner = order.type === 'SELL' ? order.seller : order.buyer
  if (!owner || !/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    return { valid: false, reason: 'Invalid owner address' }
  }
  if (typeof order.amount !== 'number' || order.amount <= 0) {
    return { valid: false, reason: 'Invalid amount' }
  }
  if (typeof order.priceKRW !== 'number' || order.priceKRW <= 0) {
    return { valid: false, reason: 'Invalid priceKRW' }
  }
  if (typeof order.expiry !== 'number' || order.expiry <= 0) {
    return { valid: false, reason: 'Invalid expiry' }
  }
  if (!order.signature) {
    return { valid: false, reason: 'Missing signature' }
  }
  if (isOrderExpired(order)) {
    return { valid: false, reason: 'Order has expired' }
  }

  return { valid: true }
}

/**
 * Get the owner address of an order (seller for SELL, buyer for BUY).
 * @param {Order} order
 * @returns {string}
 */
export function getOrderOwner(order) {
  return order.type === 'SELL' ? order.seller : order.buyer
}

/**
 * Strip sensitive fields from a sell order before broadcasting.
 * bankAccount is only revealed after accept.
 *
 * @param {SellOrder} order
 * @returns {SellOrder}
 */
export function stripSensitiveFields(order) {
  if (order.type !== 'SELL') return order
  const { bankAccount, ...rest } = order
  return { ...rest, bankAccount: '' }
}
