// ─── Frontend Relay Client ────────────────────────────────────────────────────
//
// 사용자가 EIP-712 서명 → 백엔드 릴레이 API 호출 → 배포자가 가스비 대납.
//
// 사용법:
//   const { txHash } = await relayEscrowAction(walletClient, publicClient, {
//     action: 'deposit',
//     params: { buyer: '0x...', amount: 100_000_000n },
//     from: '0x...',  // 사용자 주소
//     escrowAddress: '0x...',
//     chainId: 42161,
//   })

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL ?? ''

// ── ABI 조각 — metaNonces 읽기 ──────────────────────────────────────────────
const META_NONCES_ABI = [{
  name: 'metaNonces',
  type: 'function',
  stateMutability: 'view',
  inputs:  [{ name: 'owner', type: 'address' }],
  outputs: [{ type: 'uint256' }],
}]

// ── EIP-712 타입 정의 ─────────────────────────────────────────────────────────

function getDomain(escrowAddress, chainId) {
  return {
    name:              'MiniSwapEscrow',
    version:           '1',
    chainId:           chainId,
    verifyingContract: escrowAddress,
  }
}

function buildTypedData(action, domain, from, params, nonce, deadline) {
  switch (action) {
    case 'deposit':
      return {
        domain,
        types: {
          DepositFor: [
            { name: 'seller',   type: 'address' },
            { name: 'buyer',    type: 'address' },
            { name: 'amount',   type: 'uint256' },
            { name: 'nonce',    type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'DepositFor',
        message: {
          seller:   from,
          buyer:    params.buyer,
          amount:   params.amount,
          nonce,
          deadline,
        },
      }

    case 'release':
      return {
        domain,
        types: {
          ReleaseFor: [
            { name: 'actor',    type: 'address' },
            { name: 'tradeId',  type: 'bytes32' },
            { name: 'nonce',    type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'ReleaseFor',
        message: { actor: from, tradeId: params.tradeId, nonce, deadline },
      }

    case 'dispute':
      return {
        domain,
        types: {
          DisputeFor: [
            { name: 'actor',    type: 'address' },
            { name: 'tradeId',  type: 'bytes32' },
            { name: 'nonce',    type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'DisputeFor',
        message: { actor: from, tradeId: params.tradeId, nonce, deadline },
      }

    case 'refund':
      return {
        domain,
        types: {
          RefundFor: [
            { name: 'actor',    type: 'address' },
            { name: 'tradeId',  type: 'bytes32' },
            { name: 'nonce',    type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'RefundFor',
        message: { actor: from, tradeId: params.tradeId, nonce, deadline },
      }

    default:
      throw new Error(`Unknown relay action: ${action}`)
  }
}

// ── 메인 릴레이 함수 ──────────────────────────────────────────────────────────

/**
 * EIP-712 서명 후 릴레이 API를 통해 트랜잭션을 제출합니다.
 *
 * @param {object} walletClient  - viem walletClient (wagmi useWalletClient)
 * @param {object} publicClient  - viem publicClient (wagmi usePublicClient)
 * @param {object} opts
 * @param {string} opts.action        - 'deposit'|'release'|'dispute'|'refund'
 * @param {object} opts.params        - 액션별 파라미터 (buyer/amount 또는 tradeId)
 * @param {string} opts.from          - 사용자 지갑 주소
 * @param {string} opts.escrowAddress - 에스크로 컨트랙트 주소
 * @param {number} opts.chainId       - 체인 ID (42161)
 * @returns {Promise<{ txHash: string }>}
 */
export async function relayEscrowAction(walletClient, publicClient, { action, params, from, escrowAddress, chainId }) {
  // 1. 현재 nonce 조회
  const nonce = await publicClient.readContract({
    address:      escrowAddress,
    abi:          META_NONCES_ABI,
    functionName: 'metaNonces',
    args:         [from],
  })

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1시간 유효

  // 2. EIP-712 타입드 데이터 서명
  const typedData = buildTypedData(
    action,
    getDomain(escrowAddress, chainId),
    from,
    params,
    nonce,
    deadline,
  )

  const signature = await walletClient.signTypedData(typedData)

  // amount는 BigInt → string 직렬화
  const serializedParams = {
    from,
    escrowAddress,
    ...params,
    ...(params.amount !== undefined ? { amount: params.amount.toString() } : {}),
  }

  // 3. 릴레이 API 호출
  const response = await fetch(`${RELAYER_URL}/api/relay`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      action,
      params:   serializedParams,
      nonce:    nonce.toString(),
      deadline: deadline.toString(),
      signature,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? `Relay failed (${response.status})`)
  }

  return data // { txHash }
}

// ── ETH Drip (첫 사용자 가스비 지원) ─────────────────────────────────────────

/**
 * USDT approve()에 필요한 소량의 ETH를 요청합니다.
 * 잔액이 이미 충분하면 에러 반환.
 *
 * @param {string} address - ETH를 받을 지갑 주소
 * @returns {Promise<{ txHash: string, amount: string }>}
 */
export async function requestEthDrip(address) {
  const response = await fetch(`${RELAYER_URL}/api/drip`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ address }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? `Drip failed (${response.status})`)
  }

  return data // { txHash, amount }
}
