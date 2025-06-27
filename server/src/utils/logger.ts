import { format } from 'util';
import { readFileSync } from 'fs';
import log4js, { Configuration, Layout, levels, PatternLayout } from 'log4js';
import config from 'config';
import { isObject, isArray, isPlainObject, isEmpty, isString, isObjectLike } from 'lodash-es';
import { context, trace } from '@opentelemetry/api';
import { ACCOUNT_ID, REQUEST_ID, SECRET_WORDS } from './consts';
import { getAsyncLocalStorageResource } from './async-local-storage';

function isPatternLayout(layout: Layout): layout is PatternLayout {
    return (layout as PatternLayout).pattern !== undefined;
}

const stars = '*******';

// Helper function to get all property names including inherited ones
function getAllPropertyNames(obj: any): string[] {
    const props = new Set<string>();
    let current = obj;
    while (current && current !== Object.prototype) {
        Object.getOwnPropertyNames(current).forEach(name => props.add(name));
        current = Object.getPrototypeOf(current);
    }
    return Array.from(props);
}

const maskDBHostUrl = (message: string) => {
    const hostUrlPattern = /`([a-zA-Z0-9.-]+:\d+)`/g;
    return message.replace(hostUrlPattern, stars);
};

function hideSecretsValues(obj: any) {
    if (isArray(obj)) {
        obj.forEach((arrayObj, i) => {
            obj[i] = hideSecretsValues(arrayObj);
        });
    } else if (isObjectLike(obj)) {
        // Iterate over all keys including inherited ones
        for (const key of getAllPropertyNames(obj)) {
            if (SECRET_WORDS.includes(key)) {
                (obj as { [index: string]: string })[key] = stars;
            } else if (isString(obj[key as keyof object]) && obj[key as keyof object]) {
                obj[key] = maskDBHostUrl(obj[key]);
            } else if (isPlainObject(obj[key as keyof typeof obj]) || isArray(obj[key as keyof typeof obj])) {
                (obj as { [index: string]: any })[key] = hideSecretsValues(obj[key as keyof object]);
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
    const path =
        isEmpty(process.env.ENV_WLMDB_BUILD_MODE) || process.env.NODE_ENV === 'simulator'
            ? config.get<string>('log4js.local-config-file')
            : config.get<string>('log4js.config-file');
    const configuration: Configuration = JSON.parse(readFileSync(path).toString());
    Object.values(configuration.appenders).forEach(appender => {
        if (appender.type === 'console' || appender.type === 'file') {
            if (isPatternLayout(appender.layout)) {
                const { layout: patternLayout } = appender;
                patternLayout.tokens = {
                    requestId: () => {
                        const requestId = getAsyncLocalStorageResource<string>(REQUEST_ID);
                        return requestId || 'system';
                    },
                    accountId: () => getAsyncLocalStorageResource<string>(ACCOUNT_ID) || 'unknown',
                    traceId: () => getTraceData()?.traceId || 'unknown',
                    message: loggingEvent =>
                        format(
                            ...loggingEvent.data.map(log => {
                                try {
                                    const logLevel = loggingEvent.level;
                                    return isObject(log)
                                        ? logLevel === levels.DEBUG
                                            ? stringifyObject(structuredClone(log))
                                            : stringifyObject(hideSecretsValues(structuredClone(log)))
                                        : log;
                                } catch (error) {
                                    // TODO: Remove me: Temporary catch to identify #<Promise> could not be cloned
                                    // eslint-disable-next-line no-console
                                    console.log('ERROR in LOG MESSAGING', error);
                                }
                                return log;
                            })
                        )
                };
            }
        }
    });

    log4js.configure(configuration);
}

function stringifyObject(obj: any) {
    if (obj instanceof Error) {
        return obj;
    }
    return JSON.stringify(obj);
}

initialize();

export default function getLogger(category: 'server' | 'got' | 'simulator' | 'access' = 'server') {
    return log4js.getLogger(category);
}

export { hideSecretsValues, getTraceData };
