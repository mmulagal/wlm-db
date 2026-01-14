/* eslint-disable no-console */
import { format } from 'util';
import { readFileSync } from 'fs';
import log4js, { Configuration, Layout, LoggingEvent, PatternLayout } from 'log4js';
import config from 'config';
import { isObject, isArray, isPlainObject, isEmpty, isString, isObjectLike } from 'lodash-es';
import { context, trace } from '@opentelemetry/api';
import { stringify } from 'flatted';
import { ACCOUNT_ID, REQUEST_ID, SECRET_WORDS } from './consts';
import { getAsyncLocalStorageResource } from './async-local-storage';

const MAX_PROTOTYPE_DEPTH = 5;

function isPatternLayout(layout: Layout): layout is PatternLayout {
    return (layout as PatternLayout).pattern !== undefined;
}

const stars = '*******';

// Helper function to get all property names including inherited ones
function getAllPropertyNames(obj: any): string[] {
    const props = new Set<string>();
    let current = obj;

    let depth = 0;

    while (current && current !== Object.prototype && depth < MAX_PROTOTYPE_DEPTH) {
        Object.getOwnPropertyNames(current).forEach(name => props.add(name));
        current = Object.getPrototypeOf(current);
        depth += 1;
    }
    return Array.from(props);
}

const maskDBHostUrl = (message: string) => {
    const hostUrlPattern = /`([a-zA-Z0-9.-]+:\d+)`/g;
    return message.replace(hostUrlPattern, stars);
};

function hideSecretsValues(obj: any, depth = 0) {
    if (depth > MAX_PROTOTYPE_DEPTH || obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (isArray(obj)) {
        obj.forEach((arrayObj, i) => {
            obj[i] = hideSecretsValues(arrayObj, depth + 1);
        });
    } else if (isObjectLike(obj)) {
        // Iterate over all keys including inherited ones
        for (const key of getAllPropertyNames(obj)) {
            if (SECRET_WORDS.includes(key)) {
                (obj as { [index: string]: string })[key] = stars;
            } else if (isString(obj[key as keyof object]) && obj[key as keyof object]) {
                obj[key] = maskDBHostUrl(obj[key]);
            } else if (isPlainObject(obj[key as keyof typeof obj]) || isArray(obj[key as keyof typeof obj])) {
                (obj as { [index: string]: any })[key] = hideSecretsValues(obj[key as keyof object], depth + 1);
            }
        }
    }

    return obj;
}

function getTraceData() {
    const activeCtx = context?.active();
    const span = trace?.getSpan(activeCtx);
    return span?.spanContext();
}

function initialize() {
    console.log('Initializing log4js logger...');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(
        `${
            isEmpty(process.env.ENV_WLMDB_BUILD_MODE)
                ? 'not set'
                : `ENV_WLMDB_BUILD_MODE: ${process.env.ENV_WLMDB_BUILD_MODE}`
        }`
    );
    const path =
        isEmpty(process.env.ENV_WLMDB_BUILD_MODE) || process.env.NODE_ENV === 'simulator'
            ? config.get<string>('log4js.local-config-file')
            : config.get<string>('log4js.config-file');
    const configuration: Configuration = JSON.parse(readFileSync(path).toString());
    Object.values(configuration.appenders).forEach(appender => {
        if (appender.type === 'console' || appender.type === 'file') {
            if (isPatternLayout(appender.layout)) {
                const { layout: patternLayout } = appender;

                // Explicit tokens
                const explicitTokens = {
                    requestId: () => {
                        const requestId = getAsyncLocalStorageResource<string>(REQUEST_ID);
                        return requestId || 'system';
                    },
                    accountId: () => getAsyncLocalStorageResource<string>(ACCOUNT_ID) || 'unknown',
                    traceId: () => getTraceData()?.traceId || 'unknown',
                    message: (loggingEvent: LoggingEvent) =>
                        format(
                            ...loggingEvent.data.map(log => {
                                try {
                                    if (isObject(log)) {
                                        // Simple safe cloning with fallback
                                        let safeLog;
                                        try {
                                            safeLog = structuredClone(log);
                                        } catch {
                                            // Simple fallback - just extract essential properties.
                                            // These fields (message, code, statusCode, type) are chosen because they are commonly present in error objects or API responses,
                                            // and provide useful context for debugging when structured cloning fails (e.g., due to circular references or non-serializable values).
                                            const uncloneableLog = log as any;
                                            safeLog = {
                                                message: uncloneableLog?.message,
                                                code: uncloneableLog?.code,
                                                statusCode: uncloneableLog?.statusCode,
                                                type: 'uncloneable_object'
                                            };
                                        }
                                        return stringifyObject(hideSecretsValues(safeLog));
                                    }
                                    return log;
                                } catch (error) {
                                    // TODO: Remove me: Temporary catch to identify #<Promise> could not be cloned
                                    // eslint-disable-next-line no-console
                                    console.log('ERROR in LOG MESSAGING', error);
                                    return isObject(log) ? '[Object: logging error]' : log;
                                }
                            })
                        )
                };

                // Proxy to generically mask any other token
                patternLayout.tokens = new Proxy(explicitTokens, {
                    get(target, prop: PropertyKey) {
                        if (typeof prop === 'string' && prop in target) {
                            return target[prop as keyof typeof target];
                        }
                        // For symbol keys, convert to string and mask its value
                        if (typeof prop === 'symbol') {
                            const symbolKey = prop.toString();
                            return (loggingEvent: any) => {
                                const value = loggingEvent?.context?.[symbolKey] || loggingEvent?.[symbolKey] || '';
                                return hideSecretsValues(value);
                            };
                        }
                        // For any other token, mask its value
                        return (loggingEvent: any) => {
                            const value = loggingEvent?.context?.[prop] || loggingEvent?.[prop] || '';
                            return hideSecretsValues(value);
                        };
                    }
                });
            }
        }
    });

    log4js.configure(configuration);
}

function stringifyObject(obj: any) {
    if (obj instanceof Error) {
        return obj;
    }
    try {
        return JSON.stringify(obj);
    } catch (_e) {
        // Fallback for circular references or non-serializable objects
        return stringify(obj);
    }
}

// Flag to track if log4js initialization failed
let log4jsInitialized = false;

try {
    initialize();
    log4jsInitialized = true;
} catch (error) {
    console.warn(
        '⚠️  Log4js initialization failed (likely read-only filesystem). Logging will fall back to console output.'
    );
}

export default function getLogger(category: 'server' | 'got' | 'simulator' | 'access' = 'server') {
    if (!log4jsInitialized) {
        // Return console-based logger when initialization fails
        return {
            trace: (msg: any, ...args: any[]) => console.log(`[TRACE] ${msg}`, ...args),
            debug: (msg: any, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args),
            info: (msg: any, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
            warn: (msg: any, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args),
            error: (msg: any, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
            fatal: (msg: any, ...args: any[]) => console.error(`[FATAL] ${msg}`, ...args),
            mark: () => {},
            level: 'INFO',
            isLevelEnabled: () => true,
            addContext: () => {},
            removeContext: () => {},
            clearContext: () => {}
        } as any;
    }
    return log4js.getLogger(category);
}

export { hideSecretsValues, getTraceData };
