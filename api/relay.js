// ─── Vercel Serverless — Meta-transaction Relay ───────────────────────────────
//
// 사용자가 EIP-712 서명만 하면, 이 엔드포인트가 배포자 지갑으로 가스비를 대납하여
// 에스크로 컨트랙트의 *For() 함수들을 호출합니다.
//
// POST /api/relay
// Body: { action, params, nonce, deadline, signature }
//   action  : 'deposit' | 'release' | 'dispute' | 'refund'
//   params  : { from, escrowAddress, buyer?, amount?, tradeId? }
//   nonce   : string (metaNonces[from])
//   deadline: string (Unix timestamp + 1시간)
//   signature: EIP-712 서명 (0x...)

import { ethers } from 'ethers'

const DEPLOYER_PK  = process.env.DEPLOYER_PRIVATE_KEY
const RPC_URL      = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'

// 최소한의 ABI — 릴레이 함수들만
const RELAY_ABI = [
  'function depositFor(address seller, address buyer, uint256 amount, uint256 nonce, uint256 deadline, bytes calldata sig) returns (bytes32)',
  'function releaseFor(address actor, bytes32 tradeId, uint256 nonce, uint256 deadline, bytes calldata sig)',
  'function disputeFor(address actor, bytes32 tradeId, uint256 nonce, uint256 deadline, bytes calldata sig)',
  'function refundFor(address actor, bytes32 tradeId, uint256 nonce, uint256 deadline, bytes calldata sig)',
]

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!DEPLOYER_PK) {
    return res.status(500).json({ error: 'Relayer not configured' })
  }

  const { action, params, nonce, deadline, signature } = req.body ?? {}

  // 필수 파라미터 검증
  if (!action || !params?.from || !params?.escrowAddress || !nonce || !deadline || !signature) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet   = new ethers.Wallet(DEPLOYER_PK, provider)
    const escrow   = new ethers.Contract(params.escrowAddress, RELAY_ABI, wallet)

    const from     = params.from
    const n        = BigInt(nonce)
    const d        = BigInt(deadline)
    const sig      = signature

    let tx

    switch (action) {
      case 'deposit': {
        const { buyer, amount } = params
        if (!buyer || !amount) return res.status(400).json({ error: 'deposit requires buyer and amount' })
        tx = await escrow.depositFor(from, buyer, BigInt(amount), n, d, sig)
        break
      }
      case 'release': {
        const { tradeId } = params
        if (!tradeId) return res.status(400).json({ error: 'release requires tradeId' })
        tx = await escrow.releaseFor(from, tradeId, n, d, sig)
        break
      }
      case 'dispute': {
        const { tradeId } = params
        if (!tradeId) return res.status(400).json({ error: 'dispute requires tradeId' })
        tx = await escrow.disputeFor(from, tradeId, n, d, sig)
        break
      }
      case 'refund': {
        const { tradeId } = params
        if (!tradeId) return res.status(400).json({ error: 'refund requires tradeId' })
        tx = await escrow.refundFor(from, tradeId, n, d, sig)
        break
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` })
    }

    console.log(`[relay] ${action} submitted txHash=${tx.hash} from=${from}`)
    res.json({ txHash: tx.hash })

  } catch (err) {
    console.error('[relay] error:', err)
    // 컨트랙트 revert 메시지 추출
    const msg = err?.shortMessage ?? err?.reason ?? err?.message ?? 'Relay failed'
    res.status(500).json({ error: msg })
  }
}
