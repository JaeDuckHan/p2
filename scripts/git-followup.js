/**
 * 잔여 파일 (launch.json, 스크립트들) 추가 커밋 + push
 */
const { spawnSync } = require('child_process')
const path = require('path')
const fs   = require('fs')

const ROOT = path.resolve(__dirname, '..')
const GIT  = ['D:\\Git\\cmd\\git.exe','D:\\Git\\bin\\git.exe','C:\\Program Files\\Git\\cmd\\git.exe']
              .find(p => fs.existsSync(p))

function git(...args) {
  console.log('$ git', args.join(' '))
  const r = spawnSync(GIT, args, { cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  return r
}

git('add', '.')
git('status', '--short')

const msg = `chore: launch.json 및 유틸 스크립트 추가

- .claude/launch.json: git-push/git-status 항목 추가
- scripts/git-push.js: 증분 커밋+푸쉬 스크립트
- scripts/git-status-check.js: 리포 상태 확인 스크립트
- scripts/git-followup.js: 잔여 파일 정리 커밋

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

const r = git('commit', '-m', msg)
const out = (r.stdout || '') + (r.stderr || '')
if (r.status !== 0 && !out.includes('nothing to commit')) {
  console.error('commit 실패'); process.exit(1)
}

git('push', 'origin', 'main')
console.log('\n✓ https://github.com/JaeDuckHan/p2')
