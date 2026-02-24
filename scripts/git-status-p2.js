const { spawnSync } = require('child_process')
const path = require('path')
const fs   = require('fs')

const ROOT = path.join(__dirname, '..', 'p2')

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

let out = '=== git status (p2/) ===\n'
out += git('status') + '\n'
out += '=== git log --oneline -5 ===\n'
out += git('log', '--oneline', '-5') + '\n'
out += '=== git remote -v ===\n'
out += git('remote', '-v') + '\n'
out += '=== git branch -a ===\n'
out += git('branch', '-a') + '\n'

process.stdout.write(out)
