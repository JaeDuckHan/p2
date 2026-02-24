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
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  console.log('Exit:', r.status)
  return r
}

// stash only tracked modified files (no untracked to avoid node_modules scan)
console.log('[1/4] git stash (tracked only)')
git('stash')

console.log('\n[2/4] git pull --rebase origin main')
const pull = git('pull', '--rebase', 'origin', 'main')
if (pull.status !== 0) {
  console.error('Pull failed! Restoring stash...')
  git('stash', 'pop')
  process.exit(1)
}

console.log('\n[3/4] git push -u origin main')
const push = git('push', '-u', 'origin', 'main')
if (push.status !== 0) {
  console.error('Push failed! Restoring stash...')
  git('stash', 'pop')
  process.exit(1)
}

console.log('\n[4/4] git stash pop')
git('stash', 'pop')

console.log('\nDone! https://github.com/JaeDuckHan/p2')
