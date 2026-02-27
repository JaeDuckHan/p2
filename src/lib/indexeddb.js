// ─── IndexedDB persistence layer ─────────────────────────────────────────────
//
// Stores orders and trade history locally in the browser.
// No server involved — all data stays on the user's device.

const DB_NAME    = 'miniswap'
const DB_VERSION = 1

const STORE_ORDERS   = 'orders'
const STORE_TRADES   = 'trades'
const STORE_SETTINGS = 'settings'

/**
 * Open (or create) the MiniSwap IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Orders store
      if (!db.objectStoreNames.contains(STORE_ORDERS)) {
        const orders = db.createObjectStore(STORE_ORDERS, { keyPath: 'id' })
        orders.createIndex('type',   'type',   { unique: false })
        orders.createIndex('seller', 'seller', { unique: false })
        orders.createIndex('buyer',  'buyer',  { unique: false })
        orders.createIndex('expiry', 'expiry', { unique: false })
      }

      // Trades store
      if (!db.objectStoreNames.contains(STORE_TRADES)) {
        const trades = db.createObjectStore(STORE_TRADES, { keyPath: 'tradeId' })
        trades.createIndex('seller',    'seller',    { unique: false })
        trades.createIndex('buyer',     'buyer',     { unique: false })
        trades.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Settings store (key-value)
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror   = () => reject(request.error)
  })
}

/** Singleton DB instance */
let _dbPromise = null

function getDB() {
  if (!_dbPromise) {
    _dbPromise = openDB()
  }
  return _dbPromise
}

// ─── Generic helpers ─────────────────────────────────────────────────────────

function txPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
  })
}

function reqPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

// ─── Orders CRUD ─────────────────────────────────────────────────────────────

/**
 * Insert or update an order.
 * @param {import('../types/order.js').Order} order
 */
export async function putOrder(order) {
  const db = await getDB()
  const tx = db.transaction(STORE_ORDERS, 'readwrite')
  tx.objectStore(STORE_ORDERS).put(order)
  return txPromise(tx)
}

/**
 * Get an order by ID.
 * @param {string} id
 * @returns {Promise<import('../types/order.js').Order|undefined>}
 */
export async function getOrder(id) {
  const db  = await getDB()
  const tx  = db.transaction(STORE_ORDERS, 'readonly')
  return reqPromise(tx.objectStore(STORE_ORDERS).get(id))
}

/**
 * Get all stored orders.
 * @returns {Promise<import('../types/order.js').Order[]>}
 */
export async function getAllOrders() {
  const db = await getDB()
  const tx = db.transaction(STORE_ORDERS, 'readonly')
  return reqPromise(tx.objectStore(STORE_ORDERS).getAll())
}

/**
 * Get orders filtered by type ('SELL' or 'BUY').
 * @param {'SELL'|'BUY'} type
 * @returns {Promise<import('../types/order.js').Order[]>}
 */
export async function getOrdersByType(type) {
  const db    = await getDB()
  const tx    = db.transaction(STORE_ORDERS, 'readonly')
  const index = tx.objectStore(STORE_ORDERS).index('type')
  return reqPromise(index.getAll(type))
}

/**
 * Delete a single order by ID.
 * @param {string} id
 */
export async function deleteOrder(id) {
  const db = await getDB()
  const tx = db.transaction(STORE_ORDERS, 'readwrite')
  tx.objectStore(STORE_ORDERS).delete(id)
  return txPromise(tx)
}

/**
 * Delete all orders whose expiry timestamp has passed.
 * @returns {Promise<number>} Count of deleted orders
 */
export async function deleteExpiredOrders() {
  const db = await getDB()
  const tx = db.transaction(STORE_ORDERS, 'readwrite')
  const store = tx.objectStore(STORE_ORDERS)
  const all   = await reqPromise(store.getAll())
  const now   = Date.now()
  let deleted = 0

  for (const order of all) {
    if (order.expiry < now) {
      store.delete(order.id)
      deleted++
    }
  }

  await txPromise(tx)
  return deleted
}

// ─── Trades CRUD ─────────────────────────────────────────────────────────────

/**
 * Save a trade record.
 * @param {Object} trade - Must include `tradeId`
 */
export async function putTrade(trade) {
  const db = await getDB()
  const tx = db.transaction(STORE_TRADES, 'readwrite')
  tx.objectStore(STORE_TRADES).put(trade)
  return txPromise(tx)
}

/**
 * Get a trade by tradeId.
 * @param {string} tradeId
 */
export async function getTrade(tradeId) {
  const db = await getDB()
  const tx = db.transaction(STORE_TRADES, 'readonly')
  return reqPromise(tx.objectStore(STORE_TRADES).get(tradeId))
}

/**
 * Get all trades.
 */
export async function getAllTrades() {
  const db = await getDB()
  const tx = db.transaction(STORE_TRADES, 'readonly')
  return reqPromise(tx.objectStore(STORE_TRADES).getAll())
}

/**
 * Get all trades where the given address is either seller or buyer.
 * @param {string} address - The wallet address to filter by
 * @returns {Promise<Object[]>}
 */
export async function getTradesByAddress(address) {
  const db = await getDB()
  const tx = db.transaction(STORE_TRADES, 'readonly')
  const all = await reqPromise(tx.objectStore(STORE_TRADES).getAll())
  const lower = address.toLowerCase()
  return all.filter(t =>
    t.seller?.toLowerCase() === lower || t.buyer?.toLowerCase() === lower
  ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

// ─── Settings ────────────────────────────────────────────────────────────────

/**
 * Save a setting (key-value pair).
 * @param {string} key
 * @param {*} value
 */
export async function setSetting(key, value) {
  const db = await getDB()
  const tx = db.transaction(STORE_SETTINGS, 'readwrite')
  tx.objectStore(STORE_SETTINGS).put({ key, value })
  return txPromise(tx)
}

/**
 * Get a setting by key.
 * @param {string} key
 * @returns {Promise<*>} The value, or undefined if not found
 */
export async function getSetting(key) {
  const db  = await getDB()
  const tx  = db.transaction(STORE_SETTINGS, 'readonly')
  const rec = await reqPromise(tx.objectStore(STORE_SETTINGS).get(key))
  return rec?.value
}
