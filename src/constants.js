// ─── Contract ABIs ────────────────────────────────────────────────────────────

export const ESCROW_ABI = [
  // ── Write functions ────────────────────────────────────────────
  {
    type: 'function', name: 'deposit', stateMutability: 'nonpayable',
    inputs: [
      { name: 'buyer',  type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'tradeId', type: 'bytes32' }],
  },
  {
    type: 'function', name: 'release', stateMutability: 'nonpayable',
    inputs:  [{ name: 'tradeId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function', name: 'refund', stateMutability: 'nonpayable',
    inputs:  [{ name: 'tradeId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function', name: 'dispute', stateMutability: 'nonpayable',
    inputs:  [{ name: 'tradeId', type: 'bytes32' }],
    outputs: [],
  },
  // ── 가스비 대납 메타-트랜잭션 함수 ────────────────────────────
  {
    type: 'function', name: 'depositFor', stateMutability: 'nonpayable',
    inputs: [
      { name: 'seller',   type: 'address' },
      { name: 'buyer',    type: 'address' },
      { name: 'amount',   type: 'uint256' },
      { name: 'nonce',    type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'sig',      type: 'bytes'   },
    ],
    outputs: [{ name: 'tradeId', type: 'bytes32' }],
  },
  {
    type: 'function', name: 'releaseFor', stateMutability: 'nonpayable',
    inputs: [
      { name: 'actor',    type: 'address' },
      { name: 'tradeId',  type: 'bytes32' },
      { name: 'nonce',    type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'sig',      type: 'bytes'   },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'disputeFor', stateMutability: 'nonpayable',
    inputs: [
      { name: 'actor',    type: 'address' },
      { name: 'tradeId',  type: 'bytes32' },
      { name: 'nonce',    type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'sig',      type: 'bytes'   },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'refundFor', stateMutability: 'nonpayable',
    inputs: [
      { name: 'actor',    type: 'address' },
      { name: 'tradeId',  type: 'bytes32' },
      { name: 'nonce',    type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'sig',      type: 'bytes'   },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'metaNonces', stateMutability: 'view',
    inputs:  [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  // ── View functions ─────────────────────────────────────────────
  {
    type: 'function', name: 'getTrade', stateMutability: 'view',
    inputs:  [{ name: 'tradeId', type: 'bytes32' }],
    outputs: [{
      name: '', type: 'tuple',
      components: [
        { name: 'seller',    type: 'address' },
        { name: 'status',    type: 'uint8'   },
        { name: 'createdAt', type: 'uint64'  },
        { name: 'buyer',     type: 'address' },
        { name: 'expiresAt', type: 'uint64'  },
        { name: 'amount',    type: 'uint128' },
        { name: 'feeAmount', type: 'uint128' },
      ],
    }],
  },
  {
    type: 'function', name: 'calcTotal', stateMutability: 'pure',
    inputs:  [{ name: 'amount', type: 'uint256' }],
    outputs: [
      { name: 'total', type: 'uint256' },
      { name: 'fee',   type: 'uint256' },
    ],
  },
  {
    type: 'function', name: 'isRefundable', stateMutability: 'view',
    inputs:  [{ name: 'tradeId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'totalLocked', stateMutability: 'view',
    inputs:  [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ── Events ─────────────────────────────────────────────────────
  {
    type: 'event', name: 'TradeDeposited',
    inputs: [
      { name: 'tradeId',   type: 'bytes32', indexed: true  },
      { name: 'seller',    type: 'address', indexed: true  },
      { name: 'buyer',     type: 'address', indexed: true  },
      { name: 'amount',    type: 'uint128', indexed: false },
      { name: 'feeAmount', type: 'uint128', indexed: false },
      { name: 'expiresAt', type: 'uint64',  indexed: false },
    ],
  },
  {
    type: 'event', name: 'TradeReleased',
    inputs: [
      { name: 'tradeId',   type: 'bytes32', indexed: true  },
      { name: 'recipient', type: 'address', indexed: true  },
      { name: 'amount',    type: 'uint128', indexed: false },
    ],
  },
  {
    type: 'event', name: 'TradeRefunded',
    inputs: [
      { name: 'tradeId',     type: 'bytes32', indexed: true  },
      { name: 'recipient',   type: 'address', indexed: true  },
      { name: 'refundTotal', type: 'uint128', indexed: false },
    ],
  },
  {
    type: 'event', name: 'TradeDisputed',
    inputs: [
      { name: 'tradeId',    type: 'bytes32', indexed: true },
      { name: 'disputedBy', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event', name: 'TradeResolved',
    inputs: [
      { name: 'tradeId', type: 'bytes32', indexed: true  },
      { name: 'winner',  type: 'address', indexed: true  },
      { name: 'amount',  type: 'uint128', indexed: false },
    ],
  },
]

export const USDT_ABI = [
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs:  [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs:  [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'decimals', stateMutability: 'view',
    inputs:  [],
    outputs: [{ type: 'uint8' }],
  },
]

// ─── Chain-specific USDT addresses ───────────────────────────────────────────
export const USDT_ADDRESSES = {
  42161:  '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // Arbitrum One
  421614: '0x3f14920c99BEB920Afa163031c4e47a3e03B3e4A', // Arbitrum Sepolia
  137:    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // Polygon
}

export const USDT_DECIMALS = 6

// ─── Trade status enum (mirrors Solidity TradeStatus) ─────────────────────────
export const TradeStatus = {
  LOCKED:   0,
  RELEASED: 1,
  DISPUTED: 2,
  REFUNDED: 3,
}

export const STATUS_LABEL = {
  [TradeStatus.LOCKED]:   'LOCKED',
  [TradeStatus.RELEASED]: 'RELEASED',
  [TradeStatus.DISPUTED]: 'DISPUTED',
  [TradeStatus.REFUNDED]: 'REFUNDED',
}

export const STATUS_CLASS = {
  [TradeStatus.LOCKED]:   'badge-locked',
  [TradeStatus.RELEASED]: 'badge-released',
  [TradeStatus.DISPUTED]: 'badge-disputed',
  [TradeStatus.REFUNDED]: 'badge-refunded',
}
