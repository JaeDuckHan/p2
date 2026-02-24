const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const entries = fs.readdirSync(ROOT, { withFileTypes: true })

const pad = (s, n) => s.padEnd(n)

for (const e of entries) {
  const full = path.join(ROOT, e.name)
  try {
    const stat = fs.statSync(full)
    const type = e.isDirectory() ? 'd' : '-'
    const size = String(stat.size).padStart(10)
    const mtime = stat.mtime.toISOString().slice(0, 19).replace('T', ' ')
    console.log(`${type}  ${size}  ${mtime}  ${e.name}`)
  } catch {
    console.log(`?          ?  ?                    ${e.name}`)
  }
}
