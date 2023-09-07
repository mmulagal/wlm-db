import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const JS_EXTENSION = '.js';
const MJS_EXTENSION = '.mjs';
const CJS_EXTENSION = '.cjs';

type Format = 'builtin' | 'commonjs' | 'json' | 'module' | 'wasm';

interface ResolveContext {
    conditions: string[];
    importAssertions: any;
    parentURL: string | undefined;
}

interface ResolveOutput {
    format: Format | null | undefined;
    shortCircuit: boolean | undefined;
    url: string;
}

interface LoadContext {
    conditions: string[];
    importAssertions: any;
    format: Format | null | undefined;
}

interface LoadOutput {
    format: Format;
    shortCircuit: boolean | undefined;
    source: string | ArrayBuffer | ArrayBufferView;
}

async function resolve(
    specifier: string,
    context: ResolveContext,
    nextResolve: (specifier: string, context: ResolveContext) => ResolveOutput
): Promise<ResolveOutput> {
    const { parentURL } = context;

    if (
        parentURL &&
        specifier.startsWith('.') &&
        !specifier.endsWith(JS_EXTENSION) &&
        !specifier.endsWith(MJS_EXTENSION) &&
        !specifier.endsWith(CJS_EXTENSION)
    ) {
        const path = join(dirname(fileURLToPath(parentURL)), `${specifier}${JS_EXTENSION}`);

        return {
            shortCircuit: true,
            format: 'module',
            url: pathToFileURL(path).href
        };
    }
    if (parentURL && specifier.includes('plugin')) {
        return nextResolve(`${specifier}.js`, context);
    }

    return nextResolve(specifier, context);
}

async function load(
    url: string,
    context: LoadContext,
    nextLoad: (specifier: string, context: LoadContext) => LoadOutput
): Promise<LoadOutput> {
    return nextLoad(url, context);
}

export { resolve, load };
