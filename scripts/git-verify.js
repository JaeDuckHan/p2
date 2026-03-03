const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const ROOT = path.resolve(__dirname, '..')
const GIT = 'D:\\Git\\cmd\\git.exe'
const OUT = path.join(ROOT, 'scripts', 'git-output.txt')

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 10000 })
  } catch (e) { return e.stdout || e.message }
}

let result = ''
result += '=== STATUS ===\n'
result += run(`"${GIT}" status`) + '\n'
result += '=== LOG ===\n'
result += run(`"${GIT}" log --oneline -5`) + '\n'

fs.writeFileSync(OUT, result, 'utf8')

const server = http.createServer((_, res) => res.end(result))
server.listen(9876, () => setTimeout(() => { server.close(); process.exit(0) }, 3000))
