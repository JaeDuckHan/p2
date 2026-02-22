/**
 * git init → add → commit → remote → push
 * Node.js script (Bash tool은 WSL shim으로 동작 불가)
 */
const { spawnSync } = require('child_process')
const path = require('path')
const fs   = require('fs')

const ROOT        = path.resolve(__dirname, '..')
const REMOTE_URL  = 'https://github.com/JaeDuckHan/p2'
const BRANCH      = 'main'

// ── git 실행파일 탐색 ──────────────────────────────────────────
const GIT_CANDIDATES = [
  'D:\\Git\\cmd\\git.exe',
  'D:\\Git\\bin\\git.exe',
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe',
]
const GIT = GIT_CANDIDATES.find(p => fs.existsSync(p))
if (!GIT) {
  console.error('[git-push] git 실행파일을 찾을 수 없습니다.')
  console.error('탐색한 경로:', GIT_CANDIDATES)
  process.exit(1)
}
console.log('[git-push] git 경로:', GIT)

// ── 헬퍼 ──────────────────────────────────────────────────────
function git(...args) {
  console.log('\n$', 'git', args.join(' '))
  const result = spawnSync(GIT, args, {
    cwd:      ROOT,
    encoding: 'utf8',
    env:      { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  return result
}

// ── 메인 ──────────────────────────────────────────────────────
;(async () => {

  // 1) git init (이미 초기화돼 있으면 무시)
  const isRepo = fs.existsSync(path.join(ROOT, '.git'))
  if (!isRepo) {
    console.log('\n[1/6] git init')
    git('init', '-b', BRANCH)
  } else {
    console.log('\n[1/6] 이미 git repo 입니다. init 건너뜀')
  }

  // 2) remote 설정
  console.log('\n[2/6] remote 설정')
  const remotes = git('remote').stdout || ''
  if (remotes.includes('origin')) {
    git('remote', 'set-url', 'origin', REMOTE_URL)
  } else {
    git('remote', 'add', 'origin', REMOTE_URL)
  }

  // 3) 파일 스테이징 (node_modules 제외)
  console.log('\n[3/6] git add')
  git('add', '.')

  // 4) 스테이징 현황 출력
  console.log('\n[4/6] git status')
  git('status', '--short')

  // 5) 커밋
  const msg = `feat: MiniSwap 초기 커밋

- MiniSwapEscrow.sol : P2P USDT↔KRW 에스크로 컨트랙트
  * 6 functions: deposit / release / refund / dispute / adminResolve / forceRefundExpiredDispute
  * 2% fee, 7-day expiry, 30-day dispute window, 2-of-2 admin multisig
  * Inline ReentrancyGuard, custom errors, struct packing (3 slots)
- test/MiniSwapEscrow.test.js : Hardhat 테스트 102개 전부 통과
- scripts/deploy.js : 로컬/Arbitrum 배포 스크립트
- frontend (React + Vite + wagmi v2 + Trystero P2P)
  * src/constants.js, deployments.js, lib/wagmi.js
  * hooks: useEscrow.js, useP2P.js
  * components: WalletButton, CreateTrade, JoinTrade, TradeRoom

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

  console.log('\n[5/6] git commit')
  const commitResult = git('commit', '-m', msg)
  if (commitResult.status !== 0) {
    // 변경사항 없을 수도 있음
    if ((commitResult.stdout + commitResult.stderr).includes('nothing to commit')) {
      console.log('커밋할 변경사항 없음 — push 진행합니다')
    } else {
      console.error('commit 실패')
      process.exit(1)
    }
  }

  // 6) push
  console.log('\n[6/6] git push')
  const pushResult = git('push', '-u', 'origin', BRANCH)
  if (pushResult.status !== 0) {
    console.error('\n[git-push] push 실패. 아래 오류를 확인하세요.')
    process.exit(1)
  }

  console.log('\n✓ 완료! https://github.com/JaeDuckHan/p2')
})()
