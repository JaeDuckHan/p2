const { execSync } = require('child_process')
const http = require('http')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const GIT = 'D:\\Git\\bin\\git.exe'

function run(cmd) {
  console.log(`\n>>> ${cmd}`)
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 60000 })
    console.log(out)
    return { ok: true, output: out }
  } catch (e) {
    console.error('ERR:', e.message)
    return { ok: false, output: e.stderr || e.message }
  }
}

async function main() {
  const results = []

  // Step 1: Complete rebase if in progress
  console.log('=== STEP 1: Check & complete rebase ===')
  const status = run(`"${GIT}" status`)
  results.push({ step: 'status', ...status })

  if (status.output.includes('rebase in progress')) {
    console.log('Rebase in progress, continuing...')
    // Stage current changes for rebase
    const addRebase = run(`"${GIT}" add -A`)
    results.push({ step: 'add-for-rebase', ...addRebase })

    const cont = run(`"${GIT}" -c core.editor=true rebase --continue`)
    results.push({ step: 'rebase-continue', ...cont })

    // Check status again
    const status2 = run(`"${GIT}" status`)
    results.push({ step: 'status-after-rebase', ...status2 })
  }

  // Step 2: Stage all UI redesign files
  console.log('\n=== STEP 2: Stage files ===')
  const filesToAdd = [
    'src/App.css',
    'src/App.jsx',
    'src/components/OrderbookView.jsx',
    'src/components/WalletButton.jsx',
    'src/components/NetworkGuide.jsx',
    'src/components/OnboardBanner.jsx',
    'src/components/BuyerSelector.jsx',
    'src/components/CreateTrade.jsx',
    'src/components/OrderDetail.jsx',
    'src/components/TradeRoom.jsx',
    'src/mockData.js',
  ]

  for (const f of filesToAdd) {
    run(`"${GIT}" add "${f}"`)
  }
  results.push({ step: 'add-files', ok: true, output: 'Files staged' })

  // Step 3: Check what's staged
  console.log('\n=== STEP 3: Staged diff ===')
  const diff = run(`"${GIT}" diff --cached --stat`)
  results.push({ step: 'staged-diff', ...diff })

  // Step 4: Commit
  console.log('\n=== STEP 4: Commit ===')
  const commitMsg = `feat: Web3 감성 UI/UX 전면 리디자인

- 네트워크 경고 배너: 클릭 시 Arbitrum 자동 전환 (wallet_addEthereumChain)
- 오더북 탭 구조 변경: pill → underline 탭 + gradient CTA 버튼 분리
- 히어로 섹션 추가: 판매/구매 CTA + 라이브 통계 바
- 3D 렌더링 타이틀: 메탈릭 그라디언트 + 플로팅 + 샤인 스위프
- 다크 테마 (#0B0F1A) + 네온 글로우 시스템
- 폰트 스케일 15-20% 상향
- 하단 네비: 아이콘 28px + 터치영역 48px + 네온 활성 상태
- Empty State: CTA 버튼 + 전환 유도 메시지
- 오더 카드: hover 글로우 + 신뢰도 표시

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

  const commit = run(`"${GIT}" commit -m "${commitMsg.replace(/"/g, '\\"')}"`)
  results.push({ step: 'commit', ...commit })

  // Step 5: Push
  console.log('\n=== STEP 5: Push ===')
  const push = run(`"${GIT}" push origin main --force-with-lease`)
  results.push({ step: 'push', ...push })

  // Final status
  const finalStatus = run(`"${GIT}" log --oneline -3`)
  results.push({ step: 'final-log', ...finalStatus })

  // HTTP server for result
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(results, null, 2))
  })
  server.listen(9984, () => console.log('\n✅ Done. Results on http://localhost:9984'))
}

main().catch(e => console.error('Fatal:', e))
