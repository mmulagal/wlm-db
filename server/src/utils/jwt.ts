import jwksRsa from 'jwks-rsa';
import { isEmpty } from 'lodash-es';
import jsonwebtoken, { JwtPayload } from 'jsonwebtoken';
import createError from 'http-errors';
import {
    AUTH0_SERVER_ADDRESS,
    AUTH0_AUDIENCE,
    USER_TENANCY_CACHE_TYPE,
    ADMIN_ROLE,
    USER_ROLE,
    LOCAL_AUTH
} from './consts';
import getLogger from './logger';
import { getPermissionsForUser, getTenancyAccounts, Account } from '../lib/cloud-manager/tenancy';
import { hasCache, readFromCacheByKey, writeToCache } from './cache';

const logger = getLogger();

const CLIENT = (jwksuri: string) =>
    jwksRsa({
        cache: true,
        cacheMaxEntries: 60,
        rateLimit: true,
        jwksRequestsPerMinute: 30,
        jwksUri: `${jwksuri}/.well-known/jwks.json`,
        requestHeaders: { 'User-Agent': 'WLMDB' }
    });

async function verifyToken(token: string) {
    logger.debug('Verify token', token);
    const jwt = jsonwebtoken.decode(token, { complete: true });
    if (jwt) {
        // Determine JWKS URI based on token subject - Auth0 is user, else service token.
        const isUserAuth = (jwt.payload.sub as string)?.includes('auth0');
        const jwksuri = isUserAuth ? AUTH0_SERVER_ADDRESS : LOCAL_AUTH.ENDPOINT;
        const issuer = isUserAuth ? `${AUTH0_SERVER_ADDRESS}/` : LOCAL_AUTH.ISSUER;
        const audience = isUserAuth ? AUTH0_AUDIENCE : LOCAL_AUTH.AUDIENCE;
        const signingKey = await CLIENT(jwksuri).getSigningKey(jwt.header.kid);

        return new Promise<string | jsonwebtoken.JwtPayload>((resolve, reject) => {
            jsonwebtoken.verify(
                token,
                signingKey.getPublicKey(),
                {
                    audience,
                    issuer,
                    algorithms: ['RS256']
                },
                (error, payload) => (error || !payload ? reject(error) : resolve(payload))
            );
        });
    }
    const errMsg = 'Token decode failed';
    logger.error(errMsg);
    throw new Error(errMsg);
}

interface TenancyUserPermissions {
    role: string;
    permissions: [string];
}
async function getTenancyUserPermissions(
    authorization: string,
    tokenSub: string,
    accountId: string
): Promise<TenancyUserPermissions | undefined> {
    logger.debug('Getting tenancy user permissions', { tokenSub, accountId });

    let userPermissionsResponse;
    const cacheKey = `${tokenSub}-permissions`;
    if (!process.env.TEST && hasCache(USER_TENANCY_CACHE_TYPE, cacheKey)) {
        userPermissionsResponse = readFromCacheByKey(USER_TENANCY_CACHE_TYPE, cacheKey);
    } else {
        userPermissionsResponse = await getPermissionsForUser(authorization, accountId);
        writeToCache(USER_TENANCY_CACHE_TYPE, cacheKey, userPermissionsResponse);
    }

    return userPermissionsResponse ? (userPermissionsResponse as TenancyUserPermissions) : undefined;
}

async function authorizeJwt(authToken: string, decodedToken: JwtPayload | string, accountId: string) {
    logger.debug('Authorize JWT:', { authToken, decodedToken, accountId });
    const tokenSub = decodedToken?.sub as string;
    const isUserAuth = tokenSub?.includes('auth0');

    if (isUserAuth && tokenSub && !isEmpty(tokenSub) && !tokenSub?.endsWith('@clients')) {
        // service token ends with @clients, we cant get user permissions using service token so skipping auth for service token requests
        const unauthorizedErrorMessage = 'You do not have permission to access this resource';

        let userTenancyAccounts: Account[];
        if (hasCache(USER_TENANCY_CACHE_TYPE, tokenSub)) {
            // need not authorize role if the token is already cached as cache is populated only after authorizing the role the first time
            userTenancyAccounts = readFromCacheByKey(USER_TENANCY_CACHE_TYPE, tokenSub) as Account[];
        } else {
            const userPermissionsResponse = await getTenancyUserPermissions(authToken, tokenSub, accountId);
            if (userPermissionsResponse?.role && ![ADMIN_ROLE, USER_ROLE].includes(userPermissionsResponse?.role)) {
                throw createError(403, unauthorizedErrorMessage);
            }
            userTenancyAccounts = await getTenancyAccounts(authToken);
            if (userTenancyAccounts.length > 0) {
                writeToCache(USER_TENANCY_CACHE_TYPE, tokenSub, userTenancyAccounts);
            }
        }
        if (
            !(process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') &&
            !userTenancyAccounts?.some((account: { accountPublicId: string }) => account.accountPublicId === accountId)
        ) {
            throw createError(403, unauthorizedErrorMessage);
        }
    }
}

const jwtOperation = { verifyToken, authorizeJwt };

export default jwtOperation;
