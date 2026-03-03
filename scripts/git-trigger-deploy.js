const { execSync } = require('child_process')
const http = require('http')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const GIT = 'D:\\Git\\bin\\git.exe'

function run(cmd) {
  console.log(`>>> ${cmd}`)
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8', timeout: 60000 })
    console.log(out)
    return out
  } catch (e) {
    console.error('ERR:', e.stderr || e.message)
    return e.stderr || e.message
  }
}

const r1 = run(`"${GIT}" commit --allow-empty -m "trigger deploy"`)
const r2 = run(`"${GIT}" push origin main`)
const r3 = run(`"${GIT}" log --oneline -3`)

console.log('\n✅ Done')

const server = http.createServer((req, res) => {
  res.writeHead(200)
  res.end(JSON.stringify({ commit: r1, push: r2, log: r3 }))
})
server.listen(9983, () => console.log('http://localhost:9983'))
