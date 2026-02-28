// Polygon Amoy 테스트넷 배포 래퍼
const { execSync } = require('child_process')
const path = require('path')
const http = require('http')

const ROOT = path.resolve(__dirname, '..')

// Hardhat 실제 JS 엔트리포인트 찾기
const fs = require('fs')
const hardhatPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/hardhat/package.json'), 'utf8'))
const hardhatBin = path.join(ROOT, 'node_modules', 'hardhat', hardhatPkg.bin.hardhat)

try {
  console.log('[deploy] Polygon Amoy 테스트넷 배포 시작...')
  console.log('[deploy] Hardhat bin:', hardhatBin)

  const result = execSync(
    `"${process.execPath}" "${hardhatBin}" run scripts/deploy.js --network polygonAmoy`,
    { cwd: ROOT, stdio: 'pipe', timeout: 180000, env: { ...process.env } }
  )
  console.log(result.toString())
  console.log('[deploy] SUCCESS')
} catch (err) {
  console.error('[deploy] FAILED')
  if (err.stdout) console.error(err.stdout.toString())
  if (err.stderr) console.error(err.stderr.toString())
}

const server = http.createServer((req, res) => { res.writeHead(200); res.end('done') })
server.listen(9868, () => console.log('[deploy] Status on :9868'))
