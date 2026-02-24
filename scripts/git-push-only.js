const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const GIT = ['D:\\Git\\cmd\\git.exe','D:\\Git\\bin\\git.exe','C:\\Program Files\\Git\\cmd\\git.exe']
  .find(p => fs.existsSync(p))

console.log('Pushing to origin/main...')
const r = spawnSync(GIT, ['push', '-u', 'origin', 'main'], {
  cwd: ROOT, encoding: 'utf8', timeout: 60000,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
})
if (r.stdout) process.stdout.write(r.stdout)
if (r.stderr) process.stderr.write(r.stderr)
console.log('\nExit code:', r.status)
if (r.status === 0) console.log('Push successful!')
else console.log('Push failed.')
