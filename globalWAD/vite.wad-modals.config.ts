import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import { wadBuildResolve, wadProjectRootDir } from './vite.wad.shared'

const defineParams = process.env.NODE_ENV === 'production'
    ? { define: { 'process.env.NODE_ENV': '"production"' } }
    : {}

export default defineConfig({
    plugins: [react()],
    ...defineParams,
    resolve: wadBuildResolve,
    build: {
        outDir: 'build-wad',
        sourcemap: true,
        target: 'esnext',
        lib: {
            entry: resolve(wadProjectRootDir, 'src/wad/modals.ts'),
            formats: ['es'],
            fileName: () => 'wad-db-modals.bundle.js',
        },
        emptyOutDir: false,
    },
})
