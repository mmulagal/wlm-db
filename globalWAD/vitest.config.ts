/// <reference types="vitest" />
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { wadBuildResolve, wadProjectRootDir } from './vite.wad.shared';

export default defineConfig({
    plugins: [react()],
    resolve: {
        ...wadBuildResolve,
        alias: {
            ...wadBuildResolve.alias,
            '@wad': resolve(wadProjectRootDir, 'src/wad'),
            '@test': resolve(wadProjectRootDir, 'src/test'),
            '@netapp/bxp-design-system-react': resolve(wadProjectRootDir, 'src/test/mocks/bxpDesignSystemReact.tsx'),
            '@netapp/bxp-style/react-icons/General': resolve(wadProjectRootDir, 'src/test/mocks/bxpStyleIcons.tsx'),
            '@tlveng/workload-factory-components': resolve(
                wadProjectRootDir,
                'src/test/mocks/workloadFactoryComponents.tsx'
            )
        }
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setupTests.ts',
        include: ['src/test/**/*.{test,spec}.{ts,tsx}'],
        css: true
    }
});
