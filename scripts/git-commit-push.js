/**
 * git add (specific files) → commit → push
 */
const { spawnSync } = require('child_process')
const path = require('path')
const fs   = require('fs')

const ROOT = path.resolve(__dirname, '..')

const GIT_CANDIDATES = [
  'D:\\Git\\cmd\\git.exe',
  'D:\\Git\\bin\\git.exe',
  'C:\\Program Files\\Git\\cmd\\git.exe',
]
const GIT = GIT_CANDIDATES.find(p => fs.existsSync(p))
if (!GIT) { console.error('git not found'); process.exit(1) }

function git(...args) {
  console.log('\n$', 'git', args.join(' '))
  const r = spawnSync(GIT, args, {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  return r
}

// ── 1) Stage specific files ──
console.log('[1/4] Staging files...')
const filesToAdd = [
  'src/App.jsx',
  'src/App.css',
  'src/components/NetworkGuide.jsx',
  '.claude/launch.json',
]
for (const f of filesToAdd) {
  git('add', f)
}

// ── 2) Status check ──
console.log('\n[2/4] Staged files:')
git('diff', '--cached', '--stat')

// ── 3) Commit ──
const msg = `feat: 메인화면 리디자인 + Arbitrum 네트워크 가이드 추가

- Hero 섹션 리디자인: 큰 타이틀(3.2rem), 피처카드 3개, 이용방법 4단계
- NetworkGuide 컴포넌트: wallet_switchEthereumChain + wallet_addEthereumChain 자동 전환
  - 수동 가이드: chainlist.org / bridge.arbitrum.io 안내
  - 아이폰/모바일 사용자 MetaMask 인앱 브라우저 안내
- 잘못된 네트워크 연결 시 기존 배너 대신 전체 가이드 화면 표시
- 모바일 반응형 (600px 이하 1열 전환)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

console.log('\n[3/4] Committing...')
const commitResult = git('commit', '-m', msg)
if (commitResult.status !== 0) {
  if ((commitResult.stdout + commitResult.stderr).includes('nothing to commit')) {
    console.log('Nothing to commit')
  } else {
    console.error('Commit failed')
    process.exit(1)
  }
}

// ── 4) Push ──
console.log('\n[4/4] Pushing...')
const pushResult = git('push', '-u', 'origin', 'main')
if (pushResult.status !== 0) {
  console.error('Push failed')
  process.exit(1)
}

console.log('\n✓ Done! https://github.com/JaeDuckHan/p2')
