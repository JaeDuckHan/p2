// Git commit + push for deploy infra + worklog
const { execSync } = require('child_process')
const path = require('path')
const http = require('http')

const ROOT = path.resolve(__dirname, '..')
const run = (cmd) => {
  console.log(`$ ${cmd}`)
  const result = execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 60000 })
  const out = result.toString().trim()
  if (out) console.log(out)
  return out
}

try {
  console.log('\n=== Staging files ===')
  const files = [
    'hardhat.config.js',
    'scripts/deploy.js',
    'scripts/deploy-tron.js',
    'scripts/deploy-polygon-amoy.js',
    'scripts/deploy-tron-nile.js',
    '.env.example',
    'worklog.md',
  ]

  for (const f of files) {
    try { run(`git add "${f}"`) } catch (e) { console.log(`  skip: ${f}`) }
  }

  console.log('\n=== Committing ===')
  const msg = `chore: 배포 인프라 구축 + worklog 업데이트

- hardhat.config.js: Polygon PoS/Amoy 네트워크 추가
- deploy.js: Polygon USDT 주소 분기 추가
- deploy-tron.js: TronWeb 기반 Tron 배포 스크립트 신규
- .env.example: 배포 환경변수 템플릿
- worklog.md: 멀티체인 Phase 1-8 작업 로그 추가

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

  run(`git commit -m "${msg.replace(/"/g, '\\"')}"`)

  console.log('\n=== Pushing ===')
  run('git push origin main')

  console.log('\n=== SUCCESS ===')
} catch (err) {
  console.error('\n=== ERROR ===')
  if (err.stdout) console.error(err.stdout.toString())
  if (err.stderr) console.error(err.stderr.toString())
  console.error(err.message)
}

const server = http.createServer((req, res) => { res.writeHead(200); res.end('done') })
server.listen(9866, () => console.log('[git] Status on :9866'))
