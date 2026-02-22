/**
 * Hardhat 컴파일 검증 스크립트
 * 사용: D:\node\node.exe scripts/compile-check.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const NODE    = process.execPath;
const hardhatPkg = JSON.parse(
    require('fs').readFileSync(path.join(ROOT, 'node_modules', 'hardhat', 'package.json'), 'utf8')
);
const hardhatEntry = typeof hardhatPkg.bin === 'string' ? hardhatPkg.bin : hardhatPkg.bin.hardhat;
const hardhatBin   = path.join(ROOT, 'node_modules', 'hardhat', hardhatEntry);

console.log('[compile-check] Running hardhat compile...');
const result = spawnSync(NODE, [hardhatBin, 'compile'], {
    cwd  : ROOT,
    stdio: 'inherit',
    env  : { ...process.env, PATH: `${path.dirname(NODE)};${process.env.PATH}` },
});

if (result.status === 0) {
    console.log('[compile-check] Compilation succeeded.');
} else {
    console.error(`[compile-check] Compilation FAILED (exit ${result.status})`);
}
process.exit(result.status ?? 0);
