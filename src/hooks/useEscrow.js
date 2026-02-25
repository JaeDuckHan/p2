import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, useWalletClient, usePublicClient, useBalance } from 'wagmi'
import { parseEventLogs, parseUnits, formatUnits } from 'viem'
import { useState } from 'react'
import { ESCROW_ABI, USDT_ABI, USDT_DECIMALS, USDT_ADDRESSES } from '../constants'
import { DEPLOYMENTS } from '../deployments'
import { relayEscrowAction, requestEthDrip } from '../lib/relay'

// ─── Address helpers ───────────────────────────────────────────────────────────

export function getEscrowAddress(chainId) {
  return DEPLOYMENTS[chainId]?.escrow ?? DEPLOYMENTS[String(chainId)]?.escrow ?? null
}

export function getUsdtAddress(chainId) {
  return DEPLOYMENTS[chainId]?.usdt ?? DEPLOYMENTS[String(chainId)]?.usdt ?? USDT_ADDRESSES[chainId] ?? null
}

// ─── Format helpers ────────────────────────────────────────────────────────────

export function formatUsdt(bigint) {
  if (bigint === undefined || bigint === null) return '—'
  return formatUnits(bigint, USDT_DECIMALS)
}

export function parseUsdt(str) {
  try { return parseUnits(str, USDT_DECIMALS) } catch { return 0n }
}

// ─── useGetTrade ───────────────────────────────────────────────────────────────
/**
 * Reads trade data from the escrow contract.
 * Returns { trade, isLoading, isNotFound, refetch }
 */
export function useGetTrade(tradeId) {
  const { chainId } = useAccount()
  const addr = getEscrowAddress(chainId)
  const valid = !!tradeId && tradeId.length === 66 && !!addr

  const { data, isLoading, refetch } = useReadContract({
    address: addr,
    abi: ESCROW_ABI,
    functionName: 'getTrade',
    args: [tradeId],
    query: { enabled: valid, refetchInterval: 4000 },
  })

  const isNotFound = data && data.seller === '0x0000000000000000000000000000000000000000'
  return { trade: isNotFound ? null : data, isLoading: valid && isLoading, isNotFound, refetch }
}

// ─── useCalcTotal ──────────────────────────────────────────────────────────────
export function useCalcTotal(amountBigInt, chainId) {
  const addr = getEscrowAddress(chainId)
  const valid = !!addr && amountBigInt > 0n

  const { data } = useReadContract({
    address: addr,
    abi: ESCROW_ABI,
    functionName: 'calcTotal',
    args: [amountBigInt],
    query: { enabled: valid },
  })

  return data ? { total: data[0], fee: data[1] } : { total: 0n, fee: 0n }
}

// ─── useUsdtBalance ────────────────────────────────────────────────────────────
export function useUsdtBalance(userAddress, chainId) {
  const usdtAddr = getUsdtAddress(chainId)
  const { data } = useReadContract({
    address: usdtAddr,
    abi: USDT_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
    query: { enabled: !!userAddress && !!usdtAddr, refetchInterval: 5000 },
  })
  return data ?? 0n
}

// ─── useUsdtAllowance ──────────────────────────────────────────────────────────
export function useUsdtAllowance(userAddress, chainId) {
  const usdtAddr   = getEscrowAddress(chainId) ? getUsdtAddress(chainId) : null
  const spender    = getEscrowAddress(chainId)
  const { data, refetch } = useReadContract({
    address: usdtAddr,
    abi: USDT_ABI,
    functionName: 'allowance',
    args: [userAddress, spender],
    query: { enabled: !!userAddress && !!usdtAddr && !!spender, refetchInterval: 3000 },
  })
  return { allowance: data ?? 0n, refetch }
}

// ─── useIsRefundable ───────────────────────────────────────────────────────────
export function useIsRefundable(tradeId, chainId) {
  const addr  = getEscrowAddress(chainId)
  const valid = !!tradeId && tradeId.length === 66 && !!addr
  const { data } = useReadContract({
    address: addr,
    abi: ESCROW_ABI,
    functionName: 'isRefundable',
    args: [tradeId],
    query: { enabled: valid, refetchInterval: 4000 },
  })
  return !!data
}

// ─── useApproveUsdt ────────────────────────────────────────────────────────────
/**
 * Returns { approve, isPending, isConfirming, isSuccess, error }
 */
export function useApproveUsdt(chainId) {
  const usdtAddr   = getUsdtAddress(chainId)
  const spender    = getEscrowAddress(chainId)

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const approve = (amount) => {
    if (!usdtAddr || !spender) return
    writeContract({
      address: usdtAddr,
      abi: USDT_ABI,
      functionName: 'approve',
      args: [spender, amount],
    })
  }

  return { approve, isPending, isConfirming, isSuccess, error }
}

// ─── useDeposit ────────────────────────────────────────────────────────────────
/**
 * Returns { deposit, isPending, isConfirming, isSuccess, tradeId, error }
 * tradeId is extracted from the TradeDeposited event after confirmation.
 */
export function useDeposit(chainId) {
  const escrowAddr = getEscrowAddress(chainId)

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  let tradeId = null
  if (isSuccess && receipt) {
    try {
      const logs = parseEventLogs({ abi: ESCROW_ABI, logs: receipt.logs })
      const ev   = logs.find(l => l.eventName === 'TradeDeposited')
      if (ev) tradeId = ev.args.tradeId
    } catch {}
  }

  const deposit = (buyer, amount) => {
    if (!escrowAddr) return
    writeContract({
      address: escrowAddr,
      abi: ESCROW_ABI,
      functionName: 'deposit',
      args: [buyer, amount],
    })
  }

  return { deposit, isPending, isConfirming, isSuccess, tradeId, error, reset }
}

// ─── useRelease ────────────────────────────────────────────────────────────────
export function useRelease(chainId) {
  const escrowAddr = getEscrowAddress(chainId)
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const release = (tradeId) => {
    if (!escrowAddr) return
    writeContract({ address: escrowAddr, abi: ESCROW_ABI, functionName: 'release', args: [tradeId] })
  }

  return { release, isPending, isConfirming, isSuccess, error }
}

// ─── useRefund ─────────────────────────────────────────────────────────────────
export function useRefund(chainId) {
  const escrowAddr = getEscrowAddress(chainId)
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const refund = (tradeId) => {
    if (!escrowAddr) return
    writeContract({ address: escrowAddr, abi: ESCROW_ABI, functionName: 'refund', args: [tradeId] })
  }

  return { refund, isPending, isConfirming, isSuccess, error }
}

// ─── useDispute ────────────────────────────────────────────────────────────────
export function useDispute(chainId) {
  const escrowAddr = getEscrowAddress(chainId)
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const dispute = (tradeId) => {
    if (!escrowAddr) return
    writeContract({ address: escrowAddr, abi: ESCROW_ABI, functionName: 'dispute', args: [tradeId] })
  }

  return { dispute, isPending, isConfirming, isSuccess, error }
}

// ══════════════════════════════════════════════════════════════════════════════
//  가스비 대납 릴레이 훅 (사용자 ETH 불필요 — 배포자가 가스비 지불)
// ══════════════════════════════════════════════════════════════════════════════

// ─── 공통 릴레이 훅 팩토리 ────────────────────────────────────────────────────
function useRelayAction(chainId) {
  const escrowAddr               = getEscrowAddress(chainId)
  const { data: walletClient }   = useWalletClient()
  const publicClient             = usePublicClient()
  const { address }              = useAccount()

  const [hash,         setHash]         = useState(null)
  const [isPending,    setIsPending]    = useState(false)
  const [error,        setError]        = useState(null)

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  async function relay(action, params) {
    if (!escrowAddr || !walletClient || !publicClient || !address) return
    setIsPending(true)
    setError(null)
    try {
      const { txHash } = await relayEscrowAction(walletClient, publicClient, {
        action,
        params,
        from:          address,
        escrowAddress: escrowAddr,
        chainId,
      })
      setHash(txHash)
    } catch (err) {
      setError(err)
    } finally {
      setIsPending(false)
    }
  }

  function reset() {
    setHash(null)
    setError(null)
    setIsPending(false)
  }

  return { relay, isPending, isConfirming, isSuccess, receipt, error, reset }
}

// ─── useRelayDeposit ──────────────────────────────────────────────────────────
/**
 * 가스비 대납 에스크로 예치
 * Returns { deposit, isPending, isConfirming, isSuccess, tradeId, error, reset }
 */
export function useRelayDeposit(chainId) {
  const { relay, isPending, isConfirming, isSuccess, receipt, error, reset } = useRelayAction(chainId)

  let tradeId = null
  if (isSuccess && receipt) {
    try {
      const logs = parseEventLogs({ abi: ESCROW_ABI, logs: receipt.logs })
      const ev   = logs.find(l => l.eventName === 'TradeDeposited')
      if (ev) tradeId = ev.args.tradeId
    } catch {}
  }

  const deposit = (buyer, amount) => relay('deposit', { buyer, amount })

  return { deposit, isPending, isConfirming, isSuccess, tradeId, error, reset }
}

// ─── useRelayRelease ──────────────────────────────────────────────────────────
export function useRelayRelease(chainId) {
  const { relay, isPending, isConfirming, isSuccess, error } = useRelayAction(chainId)
  const release = (tradeId) => relay('release', { tradeId })
  return { release, isPending, isConfirming, isSuccess, error }
}

// ─── useRelayDispute ──────────────────────────────────────────────────────────
export function useRelayDispute(chainId) {
  const { relay, isPending, isConfirming, isSuccess, error } = useRelayAction(chainId)
  const dispute = (tradeId) => relay('dispute', { tradeId })
  return { dispute, isPending, isConfirming, isSuccess, error }
}

// ─── useRelayRefund ───────────────────────────────────────────────────────────
export function useRelayRefund(chainId) {
  const { relay, isPending, isConfirming, isSuccess, error } = useRelayAction(chainId)
  const refund = (tradeId) => relay('refund', { tradeId })
  return { refund, isPending, isConfirming, isSuccess, error }
}

// ─── useEthBalance + useRequestDrip ──────────────────────────────────────────
/**
 * 사용자의 ETH 잔액 조회.
 * 잔액이 적으면 드립 버튼을 표시하는 데 사용.
 */
export function useEthBalance() {
  const { address } = useAccount()
  const { data }    = useBalance({ address, query: { refetchInterval: 5000 } })
  return data?.value ?? 0n
}

/**
 * 최초 USDT approve용 ETH 드립 요청.
 * Returns { requestDrip, isDripping, dripTxHash, dripError }
 */
export function useRequestDrip() {
  const { address }               = useAccount()
  const [isDripping,  setDrip]    = useState(false)
  const [dripTxHash,  setTxHash]  = useState(null)
  const [dripError,   setError]   = useState(null)

  const requestDrip = async () => {
    if (!address) return
    setDrip(true)
    setError(null)
    try {
      const { txHash } = await requestEthDrip(address)
      setTxHash(txHash)
    } catch (err) {
      setError(err)
    } finally {
      setDrip(false)
    }
  }

  return { requestDrip, isDripping, dripTxHash, dripError }
}
