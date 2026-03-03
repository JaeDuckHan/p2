/**
 * Phase 1-5 변경사항 커밋 + 푸시
 */
const { spawnSync } = require('child_process')
const path = require('path')
const fs   = require('fs')
const http  = require('http')

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

// ── 1) Stage Phase 1-5 files ──
console.log('[1/4] Staging Phase 1-5 files...')
const filesToAdd = [
  // Phase 3: 컴포넌트 분리 + 훅 추출
  'src/App.jsx',
  'src/components/HeroSection.jsx',
  'src/components/NetworkGuide.jsx',
  'src/hooks/useAppRouter.js',
  'src/hooks/useNetworkSwitch.js',
  'src/constants/network.js',

  // Phase 4: AppShell 레이아웃 + 이벤트 추출
  'src/components/AppShell.jsx',
  'src/hooks/useTradeEvents.js',

  // Phase 5: 거래 상태 머신 + 신뢰 UX
  'src/hooks/useTradeStateMachine.js',
  'src/components/TradeTimeline.jsx',
  'src/components/EscrowBadge.jsx',
  'src/components/TradeRoom.jsx',

  // UI 컴포넌트 + 스타일 업데이트
  'src/components/ui/badge.jsx',
  'src/components/ui/button.jsx',
  'src/components/ui/card.jsx',
  'src/components/ui/input.jsx',
  'src/components/ui/tabs.jsx',
  'src/index.css',

  // 기타
  'architecture.md',
  'package-lock.json',
  '.claude/launch.json',
]
for (const f of filesToAdd) {
  const fullPath = path.join(ROOT, f)
  if (fs.existsSync(fullPath)) {
    git('add', f)
  } else {
    console.log(`  (skip: ${f} not found)`)
  }
}

// ── 2) Status check ──
console.log('\n[2/4] Staged files:')
git('diff', '--cached', '--stat')

// ── 3) Commit ──
const msg = `refactor: Phase 1-5 앱 구조 리팩토링 + 거래 UX 강화

Phase 3 — 컴포넌트 분리:
- HeroSection, NetworkGuide 추출
- useAppRouter, useNetworkSwitch 훅 생성
- 네트워크 상수 constants/network.js로 분리

Phase 4 — 레이아웃 셸:
- AppShell 레이아웃 래퍼 (Header + BottomNav)
- useTradeEvents 이벤트 리스너 훅

Phase 5 — 거래 상태 머신:
- useTradeStateMachine: 7단계 UX 상태 관리
- TradeTimeline: 5단계 시각적 타임라인
- EscrowBadge: 에스크로 보호 배지

App.jsx 402줄 → 207줄로 축소

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

console.log('\n[3/4] Committing...')
const commitResult = git('commit', '-m', msg)
if (commitResult.status !== 0) {
  if ((commitResult.stdout + commitResult.stderr).includes('nothing to commit')) {
    console.log('Nothing to commit — may already be committed')
  } else {
    console.error('Commit failed')
    process.exit(1)
  }
}

// ── 4) Push ──
console.log('\n[4/4] Pushing...')
const pushResult = git('push', '-u', 'origin', 'main')
if (pushResult.status !== 0) {
  console.error('Push failed — check authentication or network')
  process.exit(1)
}

console.log('\n=== Done! Phase 1-5 committed and pushed ===')

// Keep server alive briefly so preview_logs can read output
const server = http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Done')
})
server.listen(9989, () => console.log('Listening on 9989'))
setTimeout(() => { server.close(); process.exit(0) }, 30000)
