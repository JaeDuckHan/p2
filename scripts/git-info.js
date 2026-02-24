const { execSync } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GIT = 'D:\\Git\\bin\\git.exe';

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
}

// Collect results
const status = run(`"${GIT}" status`);
const diffUnstaged = run(`"${GIT}" diff --stat`);
const diffUnstagedFull = run(`"${GIT}" diff`);
const diffStaged = run(`"${GIT}" diff --cached --stat`);
const diffStagedFull = run(`"${GIT}" diff --cached`);
const log = run(`"${GIT}" log --oneline -5`);

// Print to console
console.log('========== GIT STATUS ==========');
console.log(status);
console.log('========== GIT DIFF --stat (unstaged) ==========');
console.log(diffUnstaged || '(none)');
console.log('========== GIT DIFF --cached --stat (staged) ==========');
console.log(diffStaged || '(none)');
console.log('========== GIT LOG --oneline -5 ==========');
console.log(log);

// Build HTML page with sections
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Git Info</title></head><body>
<h2>GIT STATUS</h2><pre>${esc(status)}</pre>
<h2>GIT DIFF --stat (unstaged)</h2><pre>${esc(diffUnstaged || '(none)')}</pre>
<h2>GIT DIFF --cached --stat (staged)</h2><pre>${esc(diffStaged || '(none)')}</pre>
<h2>GIT LOG --oneline -5</h2><pre>${esc(log)}</pre>
<h2>FULL UNSTAGED DIFF</h2><pre>${esc(diffUnstagedFull || '(none)')}</pre>
<h2>FULL STAGED DIFF</h2><pre>${esc(diffStagedFull || '(none)')}</pre>
</body></html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(9985, () => {
  console.log('HTTP server listening on http://localhost:9985');
});
