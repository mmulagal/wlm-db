import { defineConfig } from 'vitest/config';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

// These test files mutate process.env.NODE_ENV at runtime. Under isolate:false
// that env change leaks to every subsequent file in the same worker, flipping
// IS_DEMO_FLOW=false and breaking any test that calls into the marketing/auth
// code paths. They are kept in a separate project with per-file isolation so
// the shared fast path is unaffected.
const NODE_ENV_MUTATING_TESTS = [
    'test/utils/utils.test.ts',
    'test/operations/wf-internal-operations.test.ts',
    'test/operations/notification-operations.test.ts'
];

export default defineConfig({
    test: {
        // Root-level pool settings apply to all projects.
        // maxThreads / minThreads / useAtomics are only valid here, not per-project.
        ...(isGitHubActions
            ? {}
            : {
                pool: 'threads',
                poolOptions: {
                    threads: {
                        maxThreads: 4,
                        minThreads: 1,
                        useAtomics: true
                    }
                }
            }),
        coverage: {
            reporter: isGitHubActions ? ['basic'] : ['text', 'html']
        },
        projects: [
            {
                // ~128 test files: shared module state per worker, setup runs once.
                test: {
                    name: 'shared',
                    include: ['test/**/*.test.ts'],
                    exclude: NODE_ENV_MUTATING_TESTS,
                    setupFiles: ['./test/setup.ts'],
                    globals: true,
                    testTimeout: 30000,
                    isolate: false
                }
            },
            {
                // 3 files that mutate NODE_ENV: run serially with per-file isolation
                // so the env change never leaks across files.
                test: {
                    name: 'isolated',
                    include: NODE_ENV_MUTATING_TESTS,
                    setupFiles: ['./test/setup.ts'],
                    globals: true,
                    testTimeout: 30000,
                    isolate: true,
                    poolOptions: {
                        threads: {
                            singleThread: true
                        }
                    }
                }
            }
        ]
    }
});
