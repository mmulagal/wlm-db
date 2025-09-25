import { defineConfig } from 'vitest/config';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
    test: {
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
        testTimeout: 30000,
        coverage: {
            reporter: isGitHubActions ? ['basic'] : ['text', 'html']
        },
        globals: true
    }
});
