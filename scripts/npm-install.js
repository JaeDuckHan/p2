const { execSync } = require('child_process')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')

console.log('[npm-install] Running npm install...')
try {
  execSync(`"${process.execPath}" "${npmCli}" install`, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PATH: path.dirname(process.execPath) + ';' + (process.env.PATH || '') }
  })
  console.log('[npm-install] Done.')
} catch (e) {
  console.error('[npm-install] Failed:', e.message)
  process.exit(1)
}
