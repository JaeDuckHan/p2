// Vite build check script — spawn for real-time output
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')

const ROOT = path.resolve(__dirname, '..')

console.log('[build] Starting vite build...')

const child = spawn(
  process.execPath,
  [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build'],
  { cwd: ROOT, stdio: 'pipe' }
)

child.stdout.on('data', (data) => {
  process.stdout.write(data)
})

child.stderr.on('data', (data) => {
  process.stderr.write(data)
})

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n[build] SUCCESS')
  } else {
    console.error(`\n[build] FAILED with code ${code}`)
  }

  // Signal completion on port
  const server = http.createServer((req, res) => {
    res.writeHead(200)
    res.end(code === 0 ? 'build success' : 'build failed')
  })
  server.listen(9870, () => {
    console.log('[build] Status server on :9870')
  })
})
