/**
 * Hardhat 로컬 노드 부트스트랩 스크립트
 * - npm install (node_modules 없을 시)
 * - hardhat node 실행
 *
 * 사용: D:\node\node.exe scripts/start-hardhat.js
 */

const { spawnSync, spawn } = require('child_process');
const path  = require('path');
const fs    = require('fs');

const ROOT    = path.resolve(__dirname, '..');
const NODE    = process.execPath;                          // D:\node\node.exe
const NPM_CLI = path.join(path.dirname(NODE), 'node_modules', 'npm', 'bin', 'npm-cli.js');

function run(args, label) {
    console.log(`\n[start-hardhat] ${label}`);
    const result = spawnSync(NODE, [NPM_CLI, ...args], {
        cwd   : ROOT,
        stdio : 'inherit',
        env   : { ...process.env, PATH: `${path.dirname(NODE)};${process.env.PATH}` },
    });
    if (result.status !== 0) {
        console.error(`[start-hardhat] Failed: ${label} (exit ${result.status})`);
        process.exit(result.status ?? 1);
    }
}

// node_modules 없으면 설치
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'hardhat'))) {
    run(['install'], 'npm install');
}

// hardhat node 실행 (포트 8545)
// .bin/hardhat 은 bash shebang 스크립트 → Windows에서 직접 실행 불가
// hardhat package.json의 bin 필드에서 실제 JS 진입점 사용
const hardhatPkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'hardhat', 'package.json'), 'utf8'));
const hardhatEntry = typeof hardhatPkg.bin === 'string' ? hardhatPkg.bin : hardhatPkg.bin.hardhat;
const hardhatBin = path.join(ROOT, 'node_modules', 'hardhat', hardhatEntry);
console.log('\n[start-hardhat] Starting Hardhat node on port 8545...');
const proc = spawn(NODE, [hardhatBin, 'node'], {
    cwd  : ROOT,
    stdio: 'inherit',
    env  : { ...process.env, PATH: `${path.dirname(NODE)};${process.env.PATH}` },
});

proc.on('exit', (code) => process.exit(code ?? 0));
