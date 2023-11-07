import createError from 'http-errors';
import { isEmpty } from 'lodash-es';
import { hasCache, readFromCacheByKey, writeToCache } from '../../utils/cache.js';
import {
    BXP_SVC_TOKEN_TYPE,
    HEADERS,
    SECRETS,
    WF_SVC_TOKEN_TYPE,
    WLMDB,
    WORKLOAD_FACTORY_ENDPOINT
} from '../../utils/consts.js';
import { gotInstanceForInternalRequest } from '../../utils/got.js';
import getLogger from '../../utils/logger.js';

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
        if (!process.env.TEST && hasCache(WF_SVC_TOKEN_TYPE, WLMDB)) {
            return readFromCacheByKey(WF_SVC_TOKEN_TYPE, WLMDB) as tokenResponse;
        }

        const {
            access_token: accessToken,
            expires_in: expiresIn,
            token_type: tokenType
        } = await gotInstanceForInternalRequest
            .post(`${WORKLOAD_FACTORY_ENDPOINT}/auth/v1/auth/token`, {
                json: {
                    client_id: SECRETS.AUTH_CLIENT_ID,
                    client_secret: SECRETS.AUTH_CLIENT_SECRET,
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
        throw createError(500, `Error occured while getting WF service token, ${err}`);
    }
}

async function getBxpServiceToken(): Promise<{ token: string; expiresIn: number }> {
    logger.info('Getting BlueXP service token:');

    try {
        if (!process.env.TEST && hasCache(BXP_SVC_TOKEN_TYPE, WLMDB)) {
            return readFromCacheByKey(BXP_SVC_TOKEN_TYPE, WLMDB) as tokenResponse;
        }

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
            writeToCache(WF_SVC_TOKEN_TYPE, WLMDB, response, expiresIn * 1000);
        }
        return response;
    } catch (err) {
        throw createError(500, `Error occured while getting BXP service token, ${err}`);
    }
}

export { getWfServiceToken, getBxpServiceToken };
