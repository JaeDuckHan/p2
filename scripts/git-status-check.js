const { spawnSync } = require('child_process')
const path = require('path')
const fs   = require('fs')

const ROOT    = path.resolve(__dirname, '..')
const LOGFILE = path.join(ROOT, 'git-status.log')

const GIT_CANDIDATES = [
  'D:\\Git\\cmd\\git.exe',
  'D:\\Git\\bin\\git.exe',
  'C:\\Program Files\\Git\\cmd\\git.exe',
]
const GIT = GIT_CANDIDATES.find(p => fs.existsSync(p))

function git(...args) {
  const r = spawnSync(GIT, args, { cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  return (r.stdout || '') + (r.stderr || '')
}

let out = ''
out += '=== git log --oneline -5 ===\n'
out += git('log', '--oneline', '-5') + '\n'
out += '=== git remote -v ===\n'
out += git('remote', '-v') + '\n'
out += '=== git status ===\n'
out += git('status') + '\n'
out += '=== git branch -a ===\n'
out += git('branch', '-a') + '\n'

fs.writeFileSync(LOGFILE, out, 'utf8')
process.stdout.write(out)
console.log('Written to git-status.log')
