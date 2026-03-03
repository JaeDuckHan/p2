const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const opts = { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' };

function run(cmd) {
  console.log(`\n>>> ${cmd}`);
  try {
    const result = execSync(cmd, { ...opts, stdio: 'pipe' });
    if (result) console.log(result.toString());
    return true;
  } catch (e) {
    console.log('STDERR:', e.stderr?.toString() || '');
    console.log('STDOUT:', e.stdout?.toString() || '');
    return false;
  }
}

console.log('=== p2 레포 소스를 p2pusdt로 가져오기 ===\n');

// 1. 현재 상태 확인
run('git status --short');

// 2. p2 remote 추가 (이미 있으면 무시)
console.log('\n--- Adding p2 remote ---');
run('git remote add p2 https://github.com/JaeDuckHan/p2.git') ||
  run('git remote set-url p2 https://github.com/JaeDuckHan/p2.git');

// 3. remote 목록 확인
run('git remote -v');

// 4. p2에서 fetch
console.log('\n--- Fetching from p2 ---');
if (!run('git fetch p2')) {
  console.log('FETCH FAILED');
  process.exit(1);
}

// 5. p2/main 브랜치의 커밋 확인
console.log('\n--- p2/main commits ---');
run('git log p2/main --oneline -10');

// 6. 현재 변경사항 stash
console.log('\n--- Stashing current changes ---');
run('git stash');

// 7. p2/main 소스를 현재 브랜치에 머지 (allow-unrelated-histories)
console.log('\n--- Merging p2/main into current branch ---');
const mergeOk = run('git merge p2/main --allow-unrelated-histories -m "merge: p2 repo 소스 통합"');

if (!mergeOk) {
  console.log('\n--- Merge conflict detected, trying checkout --theirs ---');
  // 충돌 시 p2 소스를 우선 적용
  run('git checkout --theirs .');
  run('git add -A');
  run('git commit -m "merge: p2 repo 소스 통합 (theirs)"');
}

// 8. stash 복원
console.log('\n--- Restoring stash ---');
run('git stash pop');

// 9. 최종 상태
console.log('\n--- Final status ---');
run('git status --short');
run('git log --oneline -5');

console.log('\n=== 완료 ===');
