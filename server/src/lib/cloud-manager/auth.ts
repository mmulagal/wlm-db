import createError from 'http-errors';
import { HEADERS, SECRETS, WORKLOAD_FACTORY_ENDPOINT } from '../../utils/consts.js';
import { gotInstanceForInternalRequest } from '../../utils/got.js';
import getLogger from '../../utils/logger.js';

const logger = getLogger();

async function getWfServiceToken(): Promise<{ token: string; expiresIn: number }> {
    logger.info('Getting workload factory service token:');

    try {
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
            .json<{
                access_token: string;
                expires_in: number;
                token_type: string;
            }>();
        logger.debug('service token response', {
            accessToken,
            expiresIn,
            tokenType
        });
        return { token: `Bearer ${accessToken}`, expiresIn };
    } catch (err) {
        throw createError(500, `Error occured while getting WF service token, ${err}`);
    }
}

async function getBxpServiceToken(): Promise<{ token: string; expiresIn: number }> {
    logger.info('Getting BlueXP service token:');

    try {
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
            .json<{
                access_token: string;
                expires_in: number;
                token_type: string;
            }>();
        logger.debug('service token response', {
            accessToken,
            expiresIn,
            tokenType
        });
        return { token: `${tokenType} ${accessToken}`, expiresIn };
    } catch (err) {
        throw createError(500, `Error occured while getting BXP service token, ${err}`);
    }
}

export { getWfServiceToken, getBxpServiceToken };
