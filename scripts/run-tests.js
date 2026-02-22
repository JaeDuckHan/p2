/**
 * Hardhat 테스트 실행 스크립트 — 결과를 test-results.log 에 저장
 * 사용: D:\node\node.exe scripts/run-tests.js
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT       = path.resolve(__dirname, '..');
const NODE       = process.execPath;
const LOG_FILE   = path.join(ROOT, 'test-results.log');
const hardhatPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'hardhat', 'package.json'), 'utf8'));
const hardhatEntry = typeof hardhatPkg.bin === 'string' ? hardhatPkg.bin : hardhatPkg.bin.hardhat;
const hardhatBin   = path.join(ROOT, 'node_modules', 'hardhat', hardhatEntry);

console.log('[run-tests] Running hardhat test...\n');

// 테스트 출력을 파이프로 캡처해서 콘솔 + 파일 동시 출력
const result = spawnSync(NODE, [hardhatBin, 'test'], {
    cwd  : ROOT,
    env  : { ...process.env, PATH: `${path.dirname(NODE)};${process.env.PATH}`, FORCE_COLOR: '0' },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
});

const output = (result.stdout || '') + (result.stderr || '');
fs.writeFileSync(LOG_FILE, output, 'utf8');
process.stdout.write(output);

if (result.status === 0) {
    console.log('\n[run-tests] ✅ All tests passed.');
} else {
    console.log(`\n[run-tests] ❌ Tests FAILED (exit ${result.status})`);
}
process.exit(result.status ?? 0);
