// Tron Nile 테스트넷 배포 래퍼
const { execSync } = require('child_process')
const path = require('path')
const http = require('http')

const ROOT = path.resolve(__dirname, '..')

try {
  console.log('[deploy] Tron Nile 테스트넷 배포 시작...')

  const result = execSync(
    `"${process.execPath}" scripts/deploy-tron.js`,
    {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 180000,
      env: { ...process.env, TRON_NETWORK: 'nile' }
    }
  )
  console.log(result.toString())
  console.log('[deploy] SUCCESS')
} catch (err) {
  console.error('[deploy] FAILED')
  if (err.stdout) console.error(err.stdout.toString())
  if (err.stderr) console.error(err.stderr.toString())
}

const server = http.createServer((req, res) => { res.writeHead(200); res.end('done') })
server.listen(9867, () => console.log('[deploy] Status on :9867'))
