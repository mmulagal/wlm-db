import { defineConfig /*, Plugin*/ } from 'vite';
import react from '@vitejs/plugin-react-swc';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgr from '@svgr/rollup';

import eslint from 'vite-plugin-eslint';
import { vitePluginVersionMark } from 'vite-plugin-version-mark';
import { PRODUCTION } from './src/utils/consts';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

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
        eslint(),
        cssInjectedByJsPlugin(),
        viteTsconfigPaths(),
        //@ts-ignore
        svgr({ plugins: ['@svgr/plugin-jsx'] }),
        vitePluginVersionMark({
            name: 'wlm-db_ui_short_sha',
            ifShortSHA: true,
            ifLog: true,
            ifGlobal: true
        })
        // versionPlugin()
    ],
    server: {
        open: true,
        port: 4300
    },
    build: {
        outDir: 'build',
        minify: shouldUseSourceMap ? false : true,
        sourcemap: shouldUseSourceMap
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler',
                silenceDeprecations: ['mixed-decls']
            }
        }
    }
});
