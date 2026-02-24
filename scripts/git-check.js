const { spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const GIT = ['D:\\Git\\cmd\\git.exe','D:\\Git\\bin\\git.exe','C:\\Program Files\\Git\\cmd\\git.exe']
  .find(p => fs.existsSync(p))

const r = spawnSync(GIT, ['rev-parse', '--is-inside-work-tree'], {
  cwd: ROOT, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
})
process.stdout.write((r.stdout || '').trim() + '\n')
if (r.stderr) process.stderr.write(r.stderr)
