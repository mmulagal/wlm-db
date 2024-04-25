import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import config from 'config';
import ms from 'ms';
import { deleteFromCache, hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache.js';
import {
    BXP_SVC_TOKEN_TYPE,
    BXP_TOKEN,
    HEADERS,
    REQUEST_IN_PROGRESS_TYPE,
    SECRETS,
    WF_SVC_TOKEN_TYPE,
    WF_TOKEN,
    WLMDB,
    WORKLOAD_FACTORY_ENDPOINT
} from '../../utils/consts.js';
import { gotInstanceForInternalRequest } from '../../utils/got.js';
import getLogger from '../../utils/logger.js';
import { waitForResolution } from '../../utils/utils.js';

const logger = getLogger();

interface svcToken {
    access_token: string;
    expires_in: number;
    token_type: string;
}

interface tokenResponse {
    token: string;
    expiresIn: number;
}

async function getWfServiceToken(): Promise<{ token: string; expiresIn: number }> {
    logger.info('Getting workload factory service token:');

    try {
        if (!process.env.TEST && hasCache(REQUEST_IN_PROGRESS_TYPE, WF_TOKEN)) {
            await waitForResolution(
                () => !readFromCacheByKey(REQUEST_IN_PROGRESS_TYPE, WF_TOKEN),
                ms(config.get<string>('auth.wlmdb.interval')),
                ms(config.get<string>('auth.wlmdb.timeout'))
            );
        }

        if (!process.env.TEST && hasCache(WF_SVC_TOKEN_TYPE, WLMDB)) {
            return readFromCacheByKey(WF_SVC_TOKEN_TYPE, WLMDB) as tokenResponse;
        }

        writeToCache(REQUEST_IN_PROGRESS_TYPE, WF_TOKEN, true);

        const {
            access_token: accessToken,
            expires_in: expiresIn,
            token_type: tokenType
        } = await gotInstanceForInternalRequest
            .post(`${WORKLOAD_FACTORY_ENDPOINT}/auth/v1/auth/token`, {
                json: {
                    client_id: process.env.AUTH_CLIENT_ID || SECRETS.AUTH_CLIENT_ID,
                    client_secret: process.env.AUTH_CLIENT_SECRET || SECRETS.AUTH_CLIENT_SECRET,
                    grant_type: 'client_credentials'
                }
            })
            .json<svcToken>();
        logger.debug('service token response', {
            accessToken,
            expiresIn,
            tokenType
        });

        const response = { token: `Bearer ${accessToken}`, expiresIn };
        if (!isEmpty(accessToken)) {
            writeToCache(WF_SVC_TOKEN_TYPE, WLMDB, response, expiresIn * 1000);
        }
        return response;
    } catch (err) {
        throw createError(500, `Error occurred while getting WF service token, ${err}`);
    } finally {
        deleteFromCache(REQUEST_IN_PROGRESS_TYPE, WF_TOKEN);
    }
}

async function getBxpServiceToken(): Promise<{ token: string; expiresIn: number }> {
    logger.info('Getting BlueXP service token:');

    try {
        if (!process.env.TEST && hasCache(REQUEST_IN_PROGRESS_TYPE, BXP_TOKEN)) {
            await waitForResolution(
                () => !readFromCacheByKey(REQUEST_IN_PROGRESS_TYPE, BXP_TOKEN),
                ms(config.get<string>('auth.bluexp.interval')),
                ms(config.get<string>('auth.bluexp.timeout'))
            );
        }

        if (!process.env.TEST && hasCache(BXP_SVC_TOKEN_TYPE, WLMDB)) {
            return readFromCacheByKey(BXP_SVC_TOKEN_TYPE, WLMDB) as tokenResponse;
        }

        writeToCache(REQUEST_IN_PROGRESS_TYPE, BXP_TOKEN, true);

        const { token } = await getWfServiceToken();
        const {
            access_token: accessToken,
            expires_in: expiresIn,
            token_type: tokenType
        } = await gotInstanceForInternalRequest
            .get(`${WORKLOAD_FACTORY_ENDPOINT}/auth/v1/auth0/token`, {
                headers: {
                    [HEADERS.AUTHORIZATION]: token
                }
            })
            .json<svcToken>();
        logger.debug('service token response', {
            accessToken,
            expiresIn,
            tokenType
        });

        const response = { token: `${tokenType} ${accessToken}`, expiresIn };
        if (!isEmpty(accessToken)) {
            writeToCache(BXP_SVC_TOKEN_TYPE, WLMDB, response, expiresIn * 1000);
        }
        return response;
    } catch (err) {
        throw createError(500, `Error occurred while getting BXP service token, ${err}`);
    } finally {
        deleteFromCache(REQUEST_IN_PROGRESS_TYPE, BXP_TOKEN);
    }
}

export { getWfServiceToken, getBxpServiceToken };
