const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = process.cwd();
const SCOPE_DIR = path.join(REPO_ROOT, 'server');
const API_KEY = process.env.MM_LLM_PROXY_KEY;
const MODEL_ID = process.env.MODEL_ID || 'claude-sonnet-5-medium';
const ISSUE_NUMBER = process.env.ISSUE_NUMBER;
const ISSUE_TITLE = process.env.ISSUE_TITLE;
const ISSUE_BODY = process.env.ISSUE_BODY;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const LLM_PROXY_URL = 'https://llm-proxy-api.ai.eng.netapp.com';

if (!API_KEY) {
    console.error('Error: MM_LLM_PROXY_KEY environment variable not set');
    process.exit(1);
}

if (!ISSUE_NUMBER || !ISSUE_TITLE || !ISSUE_BODY) {
    console.error('Error: ISSUE_NUMBER, ISSUE_TITLE, and ISSUE_BODY environment variables required');
    process.exit(1);
}

const client = new Anthropic({
    apiKey: API_KEY,
    baseURL: LLM_PROXY_URL
});

const modifiedFiles = new Set();
const skippedMajorUpgrades = [];
let agentSummary = '';

function resolvePath(targetPath) {
    // All paths are resolved relative to server/, not the repo root -
    // this agent is scoped to server/ only.
    const fullPath = path.resolve(SCOPE_DIR, targetPath);

    const relativePath = path.relative(SCOPE_DIR, fullPath);
    if (relativePath.startsWith('..')) {
        throw new Error(`Path escape attempt: ${targetPath} (must stay within server/)`);
    }

    return fullPath;
}

function listFiles(dirPath) {
    try {
        const fullPath = resolvePath(dirPath);
        const entries = fs.readdirSync(fullPath);

        const filtered = entries.filter(e => {
            return !['.git', 'node_modules', '.next', 'dist', 'build', '.env'].includes(e);
        });

        return filtered.join('\n');
    } catch (err) {
        return `Error listing directory: ${err instanceof Error ? err.message : String(err)}`;
    }
}

function readFile(filePath) {
    try {
        const fullPath = resolvePath(filePath);
        return fs.readFileSync(fullPath, 'utf-8');
    } catch (err) {
        return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
    }
}

function writeFile(filePath, contents) {
    try {
        const fullPath = resolvePath(filePath);
        const allowedPath = path.join(SCOPE_DIR, 'package.json');
        if (fullPath !== allowedPath) {
            return `Error: writes are limited to server/package.json only. Refused to write: ${filePath}`;
        }

        fs.writeFileSync(fullPath, contents, 'utf-8');
        modifiedFiles.add(filePath);
        return `File written successfully: ${filePath}`;
    } catch (err) {
        return `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
    }
}

function runCommand(cmd) {
    try {
        if (cmd.includes('cd /') || cmd.includes('cd ~')) {
            return 'Error: Cannot change to system directories';
        }

        const output = execSync(cmd, {
            cwd: SCOPE_DIR,
            encoding: 'utf-8',
            maxBuffer: 5 * 1024 * 1024,
            timeout: 30000
        });

        return output || '(command succeeded with no output)';
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `Command failed: ${errorMsg}`;
    }
}

function skipMajorUpgrade(pkg, currentVersion, targetVersion, reason) {
    skippedMajorUpgrades.push({ pkg, currentVersion, targetVersion, reason });
    return `Recorded skipped major upgrade for ${pkg} (${currentVersion} -> ${targetVersion}). A comment will be added to the issue; no file was changed for this package.`;
}

// Posts a comment on the originating issue listing any major-version
// upgrades that were intentionally skipped (they may include breaking
// changes and need manual review).
async function postSkippedUpgradesComment() {
    if (skippedMajorUpgrades.length === 0 || !GITHUB_REPOSITORY) {
        return;
    }

    const lines = skippedMajorUpgrades.map(
        ({ pkg, currentVersion, targetVersion, reason }) =>
            `- **${pkg}**: ${currentVersion} -> ${targetVersion} - ${reason}`
    );

    const body = [
        '⚠️ The security agent skipped the following major-version upgrade(s) because they may include breaking changes. Please review and apply manually:',
        '',
        ...lines
    ].join('\n');

    try {
        execSync('gh issue comment ' + ISSUE_NUMBER + ' --repo ' + GITHUB_REPOSITORY + ' --body-file -', {
            cwd: REPO_ROOT,
            input: body,
            encoding: 'utf-8'
        });
        console.log('Posted skipped-major-upgrade comment on the issue.');
    } catch (err) {
        console.error('Failed to comment on issue about skipped major upgrades:', err instanceof Error ? err.message : String(err));
    }
}

async function runAgent() {
    console.log(`Starting security issue agent for issue #${ISSUE_NUMBER}`);
    console.log(`Title: ${ISSUE_TITLE}`);
    console.log('');

    const tools = [
        {
            name: 'list_files',
            description: 'List files in a directory within server/ (filters out .git, node_modules, etc.)',
            input_schema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: "Directory path to list, relative to server/ (use '.' for server/ itself)"
                    }
                },
                required: ['path']
            }
        },
        {
            name: 'read_file',
            description: "Read the contents of a file within server/. Use this to read server/package-lock.json when the vulnerable package is a transitive dependency, to trace which top-level dependency in server/package.json pulls it in.",
            input_schema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: "File path to read, relative to server/ (e.g. 'package.json' or 'package-lock.json')"
                    }
                },
                required: ['path']
            }
        },
        {
            name: 'write_file',
            description: 'Write contents to server/package.json. This is the only file this tool may write - any other path is refused. Do NOT use this for a package that needs a major-version bump - use skip_major_upgrade instead.',
            input_schema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: "Must be exactly 'package.json' (relative to server/)"
                    },
                    contents: {
                        type: 'string',
                        description: 'File contents to write'
                    }
                },
                required: ['path', 'contents']
            }
        },
        {
            name: 'run_command',
            description: 'Run a read-only inspection shell command inside server/ (e.g. npm view/list). Do not use this to modify files - use write_file for package.json edits.',
            input_schema: {
                type: 'object',
                properties: {
                    cmd: {
                        type: 'string',
                        description: "Shell command to run inside server/ (e.g., 'npm view fast-uri versions')"
                    }
                },
                required: ['cmd']
            }
        },
        {
            name: 'skip_major_upgrade',
            description: 'Call this INSTEAD of write_file when fixing a finding would require a major-version (breaking) bump of a package, or the issue text says the fix is a major/breaking upgrade. Do not edit server/package.json for this package - just record it here so a comment can be added to the issue for manual review.',
            input_schema: {
                type: 'object',
                properties: {
                    package: {
                        type: 'string',
                        description: 'Name of the package that needs a major-version upgrade'
                    },
                    current_version: {
                        type: 'string',
                        description: 'Current version in use'
                    },
                    target_version: {
                        type: 'string',
                        description: 'Version required to fix the finding'
                    },
                    reason: {
                        type: 'string',
                        description: 'Why this was skipped (e.g. "major version bump, potential breaking changes")'
                    }
                },
                required: ['package', 'current_version', 'target_version', 'reason']
            }
        },
        {
            name: 'finish',
            description: 'Signal that the fix is complete',
            input_schema: {
                type: 'object',
                properties: {
                    summary: {
                        type: 'string',
                        description: 'Summary of changes made, including any packages skipped via skip_major_upgrade'
                    }
                },
                required: ['summary']
            }
        }
    ];

    const systemPrompt = `You are a code-fixing agent for GitHub security issues. Your task:

1. Read and understand the GitHub issue provided - it may list multiple findings/packages
2. Make the minimal necessary changes to fix each finding, independently of the others
3. You may only inspect files inside the server/ directory - nothing outside it
4. You may only write to server/package.json - no other file may be created, edited, or deleted (no package-lock.json regeneration, no source code changes)
5. If the vulnerable package is a direct dependency, bump its version directly in server/package.json
6. If the vulnerable package is a transitive dependency, read server/package-lock.json first to find which direct dependency in server/package.json pulls it in, then bump that direct dependency (or add an "overrides" entry in server/package.json) so the resolved transitive version satisfies the fix
7. For EACH package/finding, determine whether the required fix is a MAJOR version bump (the leading semver number changes, e.g. 3.x.x -> 4.0.0) or the issue text explicitly says the fix is a major/breaking upgrade:
   - If it IS a major bump: do NOT modify server/package.json for that package. Instead call skip_major_upgrade with the package name, current version, target version, and reason.
   - If it is NOT a major bump (patch/minor): proceed normally and update server/package.json via write_file.
   - Evaluate each finding independently - if one finding in the issue needs a major bump and others only need minor/patch bumps, skip only the major one and still apply the others.
8. When you're done processing every finding, call the finish() tool with a summary that mentions which packages were updated and which were skipped as major upgrades

GitHub Issue #${ISSUE_NUMBER}:
Title: ${ISSUE_TITLE}

Body:
${ISSUE_BODY}

Start by exploring the server/ directory structure and understanding the issue, then process each finding as described above.`;

    const messages = [
        {
            role: 'user',
            content: systemPrompt
        }
    ];

    let iterations = 0;
    const maxIterations = 25;

    while (iterations < maxIterations) {
        iterations++;
        console.log(`\n--- Iteration ${iterations} ---`);

        const response = await client.messages.create({
            model: MODEL_ID,
            max_tokens: 4096,
            tools: tools,
            messages: messages
        });

        console.log(`Stop reason: ${response.stop_reason}`);

        // Process response content
        let hasToolUse = false;
        const toolResults = [];

        for (const block of response.content) {
            if (block.type === 'text') {
                console.log('Assistant:', block.text);
            } else if (block.type === 'tool_use') {
                hasToolUse = true;
                console.log(`\nTool call: ${block.name}`);

                const input = block.input;
                let toolResult = '';

                try {
                    if (block.name === 'list_files') {
                        toolResult = listFiles(input.path || '.');
                    } else if (block.name === 'read_file') {
                        toolResult = readFile(input.path || '');
                    } else if (block.name === 'write_file') {
                        toolResult = writeFile(input.path || '', input.contents || '');
                    } else if (block.name === 'run_command') {
                        toolResult = runCommand(input.cmd || '');
                    } else if (block.name === 'skip_major_upgrade') {
                        toolResult = skipMajorUpgrade(
                            input.package || 'unknown',
                            input.current_version || 'unknown',
                            input.target_version || 'unknown',
                            input.reason || 'major version upgrade'
                        );
                    } else if (block.name === 'finish') {
                        agentSummary = input.summary || 'Changes completed';
                        console.log(`\n✓ Agent finished with summary: ${agentSummary}`);
                        return;
                    }
                } catch (err) {
                    toolResult = `Error: ${err instanceof Error ? err.message : String(err)}`;
                }

                console.log(`Result: ${toolResult.substring(0, 200)}...`);

                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: toolResult
                });
            }
        }

        if (!hasToolUse && response.stop_reason === 'end_turn') {
            console.log('Agent finished without calling finish tool. Extracting summary from last response...');
            for (const block of response.content) {
                if (block.type === 'text') {
                    agentSummary = block.text;
                }
            }
            return;
        }

        messages.push({
            role: 'assistant',
            content: response.content
        });

        if (toolResults.length > 0) {
            messages.push({
                role: 'user',
                content: toolResults
            });
        }
    }

    console.log('Max iterations reached');
}

async function main() {
    try {
        await runAgent();
        await postSkippedUpgradesComment();

        console.log('\n=== AGENT COMPLETED ===');
        console.log(
            JSON.stringify(
                {
                    success: true,
                    filesModified: Array.from(modifiedFiles),
                    skippedMajorUpgrades,
                    summary: agentSummary
                },
                null,
                2
            )
        );
    } catch (err) {
        console.error('Agent error:', err);
        console.log(
            JSON.stringify(
                {
                    success: false,
                    error: err instanceof Error ? err.message : String(err)
                },
                null,
                2
            )
        );
        process.exit(1);
    }
}

main();
