import jwksRsa from "jwks-rsa";
import jsonwebtoken from "jsonwebtoken";
import { AUTH0_SERVER_ADDRESS, AUTH0_AUDIENCE } from "./consts";
import getLogger from "./logger";

const logger = getLogger();

const CLIENT = jwksRsa({
  cache: true,
  cacheMaxEntries: 60,
  rateLimit: true,
  jwksRequestsPerMinute: 30,
  jwksUri: `${AUTH0_SERVER_ADDRESS}/.well-known/jwks.json`,
});

export async function verifyToken(token: string) {
  logger.debug("Verify token", token);

  const jwt = jsonwebtoken.decode(token, { complete: true });
  if (jwt) {
    const signingKey = await CLIENT.getSigningKey(jwt.header.kid);

    return new Promise<string | jsonwebtoken.JwtPayload>((resolve, reject) => {
      jsonwebtoken.verify(
        token,
        signingKey.getPublicKey(),
        {
          audience: AUTH0_AUDIENCE,
          issuer: `${AUTH0_SERVER_ADDRESS}/`,
          algorithms: ["RS256"],
        },
        (error, payload) =>
          error || !payload ? reject(error) : resolve(payload)
      );
    });
  } else {
    throw new Error("Token decode failed");
  }
}
