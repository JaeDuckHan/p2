// ─── Vercel Serverless — ETH Drip for First-time Users ───────────────────────
//
// 처음 사용하는 판매자에게 Arbitrum One ETH를 소량 (0.001 ETH) 지급합니다.
// USDT approve() 트랜잭션 1회에 필요한 가스비를 커버합니다.
//
// POST /api/drip
// Body: { address }
// Rate limit: 지갑당 1회 (서버 메모리 기반, Vercel cold start 시 초기화됨)
//             실 운영 시 Vercel KV 또는 DB로 교체 권장

import { ethers } from 'ethers'

const DEPLOYER_PK  = process.env.DEPLOYER_PRIVATE_KEY
const RPC_URL      = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'

const DRIP_AMOUNT  = ethers.parseEther('0.001')  // 0.001 ETH ≈ $3 (Arbitrum approve 100번 커버)
const MIN_BALANCE  = ethers.parseEther('0.0005') // 이미 충분한 ETH가 있으면 드립 안 함

// 메모리 기반 rate limit (Vercel 재배포/cold start 시 초기화)
const drippedSet = new Set()

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (!DEPLOYER_PK) {
    return res.status(500).json({ error: 'Drip not configured' })
  }

  const { address } = req.body ?? {}

  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid address' })
  }

  const normalizedAddr = address.toLowerCase()

  // Rate limit 체크
  if (drippedSet.has(normalizedAddr)) {
    return res.status(429).json({ error: 'Already dripped to this address' })
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet   = new ethers.Wallet(DEPLOYER_PK, provider)

    // 이미 충분한 ETH 보유 여부 확인
    const balance = await provider.getBalance(address)
    if (balance >= MIN_BALANCE) {
      return res.status(400).json({ error: 'Address already has enough ETH', balance: balance.toString() })
    }

    // 릴레이어 잔액 확인
    const relayerBalance = await provider.getBalance(wallet.address)
    if (relayerBalance < DRIP_AMOUNT) {
      return res.status(503).json({ error: 'Relayer ETH balance insufficient' })
    }

    // Rate limit 마킹 (전송 전에 해서 중복 방지)
    drippedSet.add(normalizedAddr)

    // ETH 전송
    const tx = await wallet.sendTransaction({
      to: address,
      value: DRIP_AMOUNT,
    })

    console.log(`[drip] Sent 0.001 ETH to ${address}, txHash=${tx.hash}`)
    res.json({ txHash: tx.hash, amount: '0.001' })

  } catch (err) {
    // 실패 시 rate limit 해제
    drippedSet.delete(normalizedAddr)
    console.error('[drip] error:', err)
    res.status(500).json({ error: err.message ?? 'Drip failed' })
  }
}
