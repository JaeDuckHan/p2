const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GIT = 'D:\\Git\\cmd\\git.exe';

try {
  const result = execSync(
    `"${GIT}" clone https://github.com/JaeDuckHan/p2/`,
    { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', timeout: 120000 }
  );
  console.log('STDOUT:', result);
  console.log('Clone completed successfully');
} catch (err) {
  // git clone outputs progress to stderr
  if (err.stderr) console.log('STDERR:', err.stderr);
  if (err.stdout) console.log('STDOUT:', err.stdout);
  if (err.status === 0 || (err.stderr && err.stderr.includes('done'))) {
    console.log('Clone completed successfully');
  } else {
    console.error('Clone failed with exit code:', err.status);
  }
}
