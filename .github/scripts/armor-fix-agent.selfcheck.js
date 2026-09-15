// Minimal runnable self-check for the security-sensitive bits of
// armor-fix-agent.js: the run_command allowlist (must reject anything that
// isn't a bare read-only npm inspection call) and the numeric ISSUE_NUMBER
// guard. No framework - run with `node armor-fix-agent.selfcheck.js`.
const assert = require('assert');

// Module-load-time guards need these to be set before require().
process.env.MM_LLM_PROXY_KEY = 'test-key';
process.env.ISSUE_NUMBER = '123';
process.env.ISSUE_TITLE = 'test';
process.env.ISSUE_BODY = 'test';

const { ALLOWED_COMMAND, FORBIDDEN_SHELL_CHARS, runCommand } = require('./armor-fix-agent.js');

// Allowlist prefix checks
assert.strictEqual(ALLOWED_COMMAND.test('npm view fast-uri versions'), true, 'npm view should be allowed');
assert.strictEqual(ALLOWED_COMMAND.test('npm list'), true, 'npm list should be allowed');
assert.strictEqual(ALLOWED_COMMAND.test('curl https://evil.example.com'), false, 'curl must not be allowed');
assert.strictEqual(ALLOWED_COMMAND.test('rm -rf .'), false, 'rm must not be allowed');
assert.strictEqual(ALLOWED_COMMAND.test('env'), false, 'env must not be allowed');

// Shell metacharacter checks (defense against chaining a second command
// after an allowed prefix, e.g. "npm view foo; curl evil.com").
assert.strictEqual(FORBIDDEN_SHELL_CHARS.test('npm view fast-uri; curl evil.com'), true, 'semicolon chaining must be flagged');
assert.strictEqual(FORBIDDEN_SHELL_CHARS.test('npm view $(cat /etc/passwd)'), true, 'command substitution must be flagged');
assert.strictEqual(FORBIDDEN_SHELL_CHARS.test('npm view `whoami`'), true, 'backticks must be flagged');
assert.strictEqual(FORBIDDEN_SHELL_CHARS.test('npm view fast-uri versions'), false, 'plain args must not be flagged');

// End-to-end through runCommand() itself
assert.match(runCommand('curl https://evil.example.com'), /only read-only/, 'runCommand must refuse non-npm commands');
assert.match(runCommand('npm view fast-uri; env'), /disallowed shell metacharacters/, 'runCommand must refuse chained commands');
assert.match(runCommand('rm -rf /'), /only read-only/, 'runCommand must refuse destructive commands');

console.log('armor-fix-agent self-check passed.');
