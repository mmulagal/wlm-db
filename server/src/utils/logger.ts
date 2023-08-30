import { format } from 'util';
import { readFileSync } from 'fs';
import log4js, { Configuration, Layout, PatternLayout } from 'log4js';
import config from 'config';
import { isObject, cloneDeep, isArray, isPlainObject } from 'lodash-es';
import { ACCOUNT_ID, REQUEST_ID, SECRET_WORDS } from './consts';
import { getAsyncLocalStorageResource } from './async-local-storage';
import opentelemetryApi from '@opentelemetry/api';

function isPatternLayout(layout: Layout): layout is PatternLayout {
    return (layout as PatternLayout).pattern !== undefined;
}

function hideSecretsValues(obj: any) {
    if (isArray(obj)) {
        obj.forEach(arrayObj => hideSecretsValues(arrayObj));
    } else if (isObject(obj)) {
        Object.keys(obj).forEach(key => {
            if (SECRET_WORDS.includes(key)) {
                (obj as { [index: string]: string })[key] = '*******';
            } else if (isPlainObject(obj[key as keyof typeof obj]) || isArray(obj[key as keyof typeof obj])) {
                hideSecretsValues(obj[key as keyof object]);
            }
        });
    }
    return obj;
}

function getActiveTraceId() {
    const activeCtx = opentelemetryApi.context.active();
    const span = opentelemetryApi.trace.getSpan(activeCtx);
    return span?.spanContext().traceId;
}

function initialize() {
    const path = config.get<string>('log4js.config-file');
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
                    traceId: () => getActiveTraceId() || 'unknown',
                    message: loggingEvent =>
                        format(
                            ...loggingEvent.data.map(log =>
                                isObject(log) ? `${hideSecretsValues(cloneDeep(log))}\n` : log
                            )
                        )
                };
            }
        }
    });

    log4js.configure(configuration);
}

initialize();

export default function getLogger(category: 'server' | 'got' | 'simulator' | 'access' = 'server') {
    return log4js.getLogger(category);
}

export { hideSecretsValues };
