const { execSync } = require('child_process')
const http = require('http')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const run = (cmd) => {
  console.log(`$ ${cmd}`)
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 60000 })
    if (out.trim()) console.log(out.trim())
    return out
  } catch (e) {
    console.error('ERR:', e.stderr || e.message)
    return null
  }
}

// 0. Remove stale lock file
const lockFile = path.join(ROOT, '.git', 'index.lock')
if (fs.existsSync(lockFile)) {
  fs.unlinkSync(lockFile)
  console.log('[cleanup] Removed .git/index.lock')
}

// 1. Stage
console.log('\n=== STAGING ===')
run('git add src/components/ui/dialog.jsx')

// 2. Commit
console.log('\n=== COMMIT ===')
const msg = [
  'fix: Dialog을 Portal로 렌더링 — backdrop-filter containing block 문제 해결',
  '',
  '- 근본 원인: 헤더의 backdrop-blur-sm이 CSS containing block을 생성하여',
  '  Dialog의 fixed inset-0이 헤더 기준으로 동작 (뷰포트 대신 60px 영역)',
  '- createPortal(dialog, document.body)로 DOM 트리에서 분리',
  '- overflow-y-auto + min-h-full + items-center 스크롤 패턴 적용',
  '- stopPropagation으로 콘텐츠 클릭 시 닫힘 방지',
  '',
  'Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>',
].join('\n')

const msgFile = path.join(ROOT, '.git', 'COMMIT_MSG_TEMP')
fs.writeFileSync(msgFile, msg, 'utf-8')
run('git commit -F .git/COMMIT_MSG_TEMP')
fs.unlinkSync(msgFile)

// 3. Push
console.log('\n=== PUSH ===')
run('git push origin main')

// 4. Verify
console.log('\n=== RESULT ===')
run('git log --oneline -3')

const server = http.createServer((req, res) => {
  res.writeHead(200)
  res.end('done')
})
server.listen(9860, () => console.log('\n[done] Status on :9860'))
