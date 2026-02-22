import { useAccount, useConnect, useDisconnect } from 'wagmi'

function shortAddr(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function WalletButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {chain && (
          <span className="sm muted">{chain.name}</span>
        )}
        <button
          className="wallet-btn connected"
          onClick={() => disconnect()}
          title={address}
        >
          ● {shortAddr(address)}
        </button>
      </div>
    )
  }

  const injector = connectors.find(c => c.id === 'injected')

  return (
    <button
      className="wallet-btn"
      disabled={isPending}
      onClick={() => injector && connect({ connector: injector })}
    >
      {isPending ? '연결 중...' : '지갑 연결'}
    </button>
  )
}
