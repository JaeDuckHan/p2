const fs = require('fs')
const path = require('path')

function walkDir(dir) {
  let results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath))
    } else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) {
      results.push(fullPath)
    }
  }
  return results
}

const componentsDir = path.join(__dirname, '..', 'src', 'components')
const jsxFiles = walkDir(componentsDir)
console.log(`Found ${jsxFiles.length} files`)

const replacements = [
  ['text-\\[9px\\]', 'text-xs'],
  ['text-\\[10px\\]', 'text-xs'],
  ['text-\\[11px\\]', 'text-xs'],
]

let totalChanges = 0
for (const file of jsxFiles) {
  let content = fs.readFileSync(file, 'utf-8')
  let original = content
  let fileChanges = 0
  for (const [fromPattern, to] of replacements) {
    const regex = new RegExp(fromPattern, 'g')
    const matches = content.match(regex)
    if (matches) {
      fileChanges += matches.length
      content = content.replace(regex, to)
    }
  }
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8')
    console.log(`Modified: ${path.relative(componentsDir, file)} (${fileChanges} replacements)`)
    totalChanges += fileChanges
  }
}
console.log(`\nTotal: ${totalChanges} replacements`)

// Verify
console.log('\n--- Verification ---')
let remaining = 0
for (const file of jsxFiles) {
  const content = fs.readFileSync(file, 'utf-8')
  const found = []
  if (/text-\[9px\]/.test(content)) found.push('text-[9px]')
  if (/text-\[10px\]/.test(content)) found.push('text-[10px]')
  if (/text-\[11px\]/.test(content)) found.push('text-[11px]')
  if (found.length) {
    console.log(`STILL HAS: ${path.relative(componentsDir, file)} → ${found.join(', ')}`)
    remaining++
  }
}
console.log(remaining === 0
  ? 'OK: No tiny font classes remain.'
  : `WARNING: ${remaining} files still have tiny font classes.`)

process.exit(0)
