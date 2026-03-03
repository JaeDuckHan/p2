// Git commit + push for multichain Phase 6 completion
const { execSync } = require('child_process')
const path = require('path')
const http = require('http')

const ROOT = path.resolve(__dirname, '..')
const run = (cmd) => {
  console.log(`$ ${cmd}`)
  const result = execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 60000 })
  const out = result.toString().trim()
  if (out) console.log(out)
  return out
}

try {
  // 1. Check status
  console.log('\n=== Git Status ===')
  console.log(run('git status --short'))

  // 2. Stage all changed/new source files
  console.log('\n=== Staging files ===')
  const files = [
    // Phase 6 modified files
    'src/hooks/useOrderbook.js',
    'src/contexts/XmtpContext.jsx',
    'src/types/order.js',
    'src/lib/signature.js',
    // Previously modified in this session (Phase 1-5)
    'src/constants/network.js',
    'src/constants.js',
    'src/deployments.js',
    'src/lib/wagmi.js',
    'src/lib/amount.js',
    'src/lib/trystero-orderbook.js',
    'src/contexts/NetworkContext.jsx',
    'src/contexts/WalletContext.jsx',
    'src/adapters/EvmAdapter.js',
    'src/adapters/TronAdapter.js',
    'src/hooks/useTronEscrow.js',
    'src/hooks/useNetworkSwitch.js',
    'src/hooks/useEscrow.js',
    'src/components/NetworkSelector.jsx',
    'src/components/WalletButton.jsx',
    'src/components/AppShell.jsx',
    'src/components/HeroSection.jsx',
    'src/components/NetworkGuide.jsx',
    'src/components/CreateTrade.jsx',
    'src/components/JoinTrade.jsx',
    'src/components/TradeRoom.jsx',
    'src/main.jsx',
    'src/App.jsx',
  ]

  for (const f of files) {
    try {
      run(`git add "${f}"`)
    } catch (e) {
      console.log(`  skip: ${f} (not found or unchanged)`)
    }
  }

  // 3. Commit
  console.log('\n=== Committing ===')
  const msg = `feat: Phase 6 완료 — 오더북 네트워크 격리 + XMTP Tron 스킵 + 멀티체인 서명

멀티체인 구조 개편 Phase 1-6 완료:
- 런타임 네트워크 선택 (Arbitrum/Polygon/Tron)
- EVM/Tron 어댑터 패턴 + 통합 WalletContext
- NetworkSelector UI + 네트워크별 오더북 격리
- chainType 자동 감지 서명/검증 (EVM personal_sign + Tron signMessageV2)
- XMTP EVM-only 분기 + Tron 에스크로 placeholder
- Tron 주소 검증 (TronWeb.isAddress + regex fallback)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

  run(`git commit -m "${msg.replace(/"/g, '\\"')}"`)

  // 4. Push
  console.log('\n=== Pushing to origin/main ===')
  run('git push origin main')

  console.log('\n=== SUCCESS ===')
} catch (err) {
  console.error('\n=== ERROR ===')
  if (err.stdout) console.error(err.stdout.toString())
  if (err.stderr) console.error(err.stderr.toString())
  console.error(err.message)
}

// Signal completion
const server = http.createServer((req, res) => {
  res.writeHead(200)
  res.end('done')
})
server.listen(9869, () => console.log('[git] Status on :9869'))
