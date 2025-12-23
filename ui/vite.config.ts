/// <reference types="vitest" />
import { defineConfig /*, Plugin*/ } from 'vite';
import react from '@vitejs/plugin-react-swc';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgr from '@svgr/rollup';

import { vitePluginVersionMark } from 'vite-plugin-version-mark';
import { PRODUCTION } from './src/utils/consts';

// https://vitejs.dev/config/

/*
const versionPlugin: () => Plugin = () => ({
  name: 'version-plugin',
  config: (config) => {
    // get version in vitePlugin if you open `ifGlobal`
    console.log(`Logging config ${config.define}`, 'red')
  }
})
*/

const shouldUseSourceMap = process.env.VITE_APP_ENVIRONMENT !== PRODUCTION;

export default defineConfig({
    base: './',
    plugins: [
        react(),

        viteTsconfigPaths(),
        //@ts-ignore
        svgr({ plugins: ['@svgr/plugin-jsx'] }),
        vitePluginVersionMark({
            name: 'wlm-db_ui_short_sha',
            ifShortSHA: true,
            ifLog: true,
            ifGlobal: true
        }),
        // versionPlugin()

        {
            name: 'html-transform',
            transformIndexHtml(html) {
                return html.replace(/%VITE_APP_ENVIRONMENT%/g, process.env.VITE_APP_ENVIRONMENT || '');
            }
        }
    ],
    server: {
        open: true,
        port: 4300
    },
    build: {
        outDir: 'build',
        sourcemap: shouldUseSourceMap,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        return id.toString().split('node_modules/')[1].split('/')[0].toString();
                    }
                }
            }
        }
    },

    css: {
        preprocessorOptions: {
            scss: {
                silenceDeprecations: ['mixed-decls']
            }
        }
    },

    // @ts-ignore
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setupTests.ts',
        css: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'clover', 'json'],
            reportsDirectory: './coverage'
        }
    }
});
