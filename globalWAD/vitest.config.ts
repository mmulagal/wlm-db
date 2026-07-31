/// <reference types="vitest" />
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { wadBuildResolve, wadProjectRootDir } from './vite.wad.shared';

export default defineConfig({
    plugins: [react()],
    resolve: {
        ...wadBuildResolve,
        // Array form: more-specific / exact finds must come before package-root
        // prefixes, or Vite rewrites `@pkg/wad` → `<main-mock>.ts/wad`.
        alias: [
            {
                find: '@tlveng/workload-factory-components/wad',
                replacement: resolve(wadProjectRootDir, 'src/test/mocks/workloadFactoryComponentsWad.ts')
            },
            {
                find: /^@tlveng\/workload-factory-components$/,
                replacement: resolve(wadProjectRootDir, 'src/test/mocks/workloadFactoryComponentsMain.ts')
            },
            {
                find: '@wad',
                replacement: resolve(wadProjectRootDir, 'src/wad')
            },
            {
                find: '@test',
                replacement: resolve(wadProjectRootDir, 'src/test')
            },
            {
                find: '@netapp/bxp-style/react-icons/General',
                replacement: resolve(wadProjectRootDir, 'src/test/mocks/bxpStyleIcons.tsx')
            },
            {
                find: '@netapp/bxp-design-system-react',
                replacement: resolve(wadProjectRootDir, 'src/test/mocks/bxpDesignSystemReact.tsx')
            },
            {
                find: '@netapp/bxp-style',
                replacement: resolve(wadProjectRootDir, 'node_modules/@netapp/bxp-style')
            }
        ]
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setupTests.ts',
        include: ['src/test/**/*.{test,spec}.{ts,tsx}'],
        css: true
    }
});
