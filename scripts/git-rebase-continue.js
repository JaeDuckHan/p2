const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const GIT = ['D:\\Git\\cmd\\git.exe','D:\\Git\\bin\\git.exe','C:\\Program Files\\Git\\cmd\\git.exe']
  .find(p => fs.existsSync(p))

function git(...args) {
  console.log('\n$ git', args.join(' '))
  const r = spawnSync(GIT, args, {
    cwd: ROOT, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true' },
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  console.log('Exit:', r.status)
  return r
}

// 1) Checkout launch.json to discard local noise, then stage resolved files
console.log('[1/3] Staging resolved files...')
git('checkout', '--', '.claude/launch.json')
git('add', 'src/App.jsx')
git('add', 'src/App.css')
git('add', 'src/components/NetworkGuide.jsx')
git('add', '.claude/launch.json')

// 2) Status check
console.log('\n[2/3] Status:')
git('status', '--short')

// 3) Continue rebase
console.log('\n[3/3] git rebase --continue')
const rebase = git('rebase', '--continue')
if (rebase.status !== 0) {
  // If it fails, show status
  console.log('\nRebase status:')
  git('status')
  process.exit(1)
}

// 4) Push
console.log('\n[4/4] git push -u origin main')
const push = git('push', '-u', 'origin', 'main')
if (push.status !== 0) {
  console.error('Push failed')
  git('log', '--oneline', '-3')
  process.exit(1)
}

// 5) Restore stash
console.log('\n[5/5] git stash pop')
git('stash', 'pop')

console.log('\nDone! https://github.com/JaeDuckHan/p2')
