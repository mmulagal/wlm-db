import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        pool: 'threads',
        poolOptions:{
            maxThreads: 4,
            minThreads: 1,
            useAtomics: true
        },
        testTimeout: 30000,
        globals: true,
        coverage: {
            reporter: ['text', 'html']
        }
    }
});
