const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')
const ROOT = path.resolve(__dirname, '..')
const GIT = 'D:\\Git\\cmd\\git.exe'
const OUT = path.join(ROOT, 'scripts', 'git-output.txt')

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 30000 })
  } catch (e) { return e.stdout || e.stderr || e.message }
}

let result = ''
result += '=== PUSH ===\n'
result += run(`"${GIT}" push origin main`) + '\n'
result += '=== STATUS ===\n'
result += run(`"${GIT}" status`) + '\n'

fs.writeFileSync(OUT, result, 'utf8')

const server = http.createServer((_, res) => res.end(result))
server.listen(9875, () => setTimeout(() => { server.close(); process.exit(0) }, 3000))
