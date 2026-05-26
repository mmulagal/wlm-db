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
    const jwt: JwtPayload | null = jsonwebtoken.decode(token, { complete: true });
    if (jwt) {
        // Determine JWKS URI based on token iss - Auth0 is user, else service token.
        const isUserAuth = jwt.payload.iss.includes('auth0');
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

interface AuthorizeJwtResult {
    isGovAccount: boolean | undefined;
}

async function authorizeJwt(
    authToken: string,
    decodedToken: JwtPayload | string,
    accountId: string
): Promise<AuthorizeJwtResult> {
    logger.debug('Authorize JWT:', { authToken, decodedToken, accountId });
    const tokenSub = decodedToken?.sub as string;
    // A user token is any Auth0 connection-prefixed sub (`auth0|...`, `samlp|...`,
    // `oidc|...`, `waad|...`, `google-oauth2|...`, `ad|...`, etc.) that isn't a
    // service-to-service token (those end with `@clients`). The previous check
    // (`sub.includes('auth0')`) silently excluded every SAML/OIDC SSO connection
    // and caused the tenancy `isGov` lookup to be skipped for every SSO session.
    // Mirrors the `callerIsUser` pattern used by gg-skywalker's BlueXP services.
    const isUserAuth = !isEmpty(tokenSub) && !tokenSub.endsWith('@clients') && tokenSub.includes('|');
    let isGovAccount: boolean | undefined;

    if (isUserAuth) {
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

        const matchedAccount = userTenancyAccounts?.find(account => account.accountPublicId === accountId);
        isGovAccount = matchedAccount?.isGov ?? false;
        logger.debug('Tenancy account Gov status', { accountId, isGovAccount });
    }

    return { isGovAccount };
}

const jwtOperation = { verifyToken, authorizeJwt };

export default jwtOperation;
