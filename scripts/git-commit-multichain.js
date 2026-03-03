/**
 * git-commit-multichain.js
 * 멀티체인 리팩토링 변경사항을 커밋하는 스크립트
 */
const { execSync } = require('child_process')
const http = require('http')

const ROOT = require('path').resolve(__dirname, '..')
const GIT = 'D:\\Git\\cmd\\git.exe'

function run(cmd) {
  console.log(`$ ${cmd}`)
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 30000 })
    console.log(out)
    return out
  } catch (e) {
    console.error(`ERR: ${e.message}`)
    if (e.stdout) console.log(e.stdout)
    if (e.stderr) console.error(e.stderr)
    return ''
  }
}

// 1. Show status
console.log('=== GIT STATUS ===')
run(`"${GIT}" status -u`)

// 2. Show recent commits
console.log('=== RECENT COMMITS ===')
run(`"${GIT}" log --oneline -5`)

// 3. Stage the multi-chain related files
console.log('=== STAGING FILES ===')
const files = [
  'src/constants/network.js',
  'src/constants.js',
  'src/lib/wagmi.js',
  'src/hooks/useNetworkSwitch.js',
  'src/components/AppShell.jsx',
  'src/components/CreateTrade.jsx',
  'src/components/HeroSection.jsx',
  'src/components/JoinTrade.jsx',
  'src/components/NetworkGuide.jsx',
  'src/components/TradeRoom.jsx',
]
for (const f of files) {
  run(`"${GIT}" add "${f}"`)
}

// 4. Show what's staged
console.log('=== STAGED DIFF STAT ===')
run(`"${GIT}" diff --cached --stat`)

// 5. Commit
console.log('=== COMMITTING ===')
const msg = `feat: 멀티체인 지원 — Polygon 네트워크 추가 + 동적 네트워크 전환 구조

- constants/network.js에 NETWORKS 레지스트리 + ACTIVE_NETWORK 스위치 패턴 구현
- Polygon (mainnet 137 / testnet Amoy 80002) 네트워크 정의 추가
- wagmi.js에 Polygon 체인 매핑 추가
- 모든 컴포넌트에서 하드코딩된 네트워크 이름/URL 제거
- explorerName 필드 추가로 탐색기 이름 동적 표시
- ACTIVE_NETWORK 값 변경만으로 전체 앱 네트워크 전환 가능

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

run(`"${GIT}" commit -m "${msg.replace(/"/g, '\\"')}"`)

// 6. Verify
console.log('=== POST-COMMIT STATUS ===')
run(`"${GIT}" status`)
run(`"${GIT}" log --oneline -3`)

// Keep server alive briefly for log capture
const server = http.createServer((_, res) => res.end('done'))
server.listen(9877, () => {
  console.log('\n=== DONE ===')
  setTimeout(() => { server.close(); process.exit(0) }, 3000)
})
