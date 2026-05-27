import createError from 'http-errors';
import { isArray } from 'lodash-es';

import { getParameter } from '../lib/aws/ssm';

import { HttpErrorCodes, GOV_ACCOUNT } from './consts';
import { getAsyncLocalStorageResource } from './async-local-storage';

const SSM_ARN_PATTERN = /^arn:aws(-us-gov)?:ssm:([^:]+):([^:]+):parameter\/(.+)$/;

type CredentialType = 'fsx' | 'ad' | 'sql-mssql' | 'domain' | 'oracle';

/**
 * Validates SSM parameter ARN format without checking existence.
 * Used when credentialsId/region are not available (e.g., template-only routes).
 * Validates format. Partition check is only enforced when isGovCloud is true.
 */
function validateSsmArnFormat(
    ssmParameterArn: string,
    configName: string,
    region?: string,
    isGovCloud?: boolean
): void {
    const govCloud = isGovCloud ?? getAsyncLocalStorageResource<boolean>(GOV_ACCOUNT) ?? false;
    if (!govCloud) {
        return;
    }

    const arnParts = ssmParameterArn.match(SSM_ARN_PATTERN);
    if (!arnParts) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `Invalid SSM parameter ARN format in ${configName}: ${ssmParameterArn}. Expected: arn:aws-us-gov:ssm:REGION:ACCOUNT_ID:parameter/PATH`
        );
    }

    if (!arnParts[1]) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `GovCloud accounts must use a GovCloud SSM parameter ARN (arn:aws-us-gov:ssm:...) in ${configName}.`
        );
    }

    if (region && arnParts[2] !== region) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `SSM parameter ARN region (${arnParts[2]}) does not match deployment region (${region}) in ${configName}.`
        );
    }

    const paramPath = arnParts[4];
    if (!paramPath.startsWith('netapp/wlmdb/')) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `SSM parameter path must start with 'netapp/wlmdb/' in ${configName}. Got: ${paramPath}`
        );
    }
}

/**
 * Validates the JSON structure of an SSM parameter value matches expected credential format.
 */
function validateCredentialJsonStructure(
    parsedValue: unknown,
    credentialType: CredentialType,
    configName: string
): void {
    if (typeof parsedValue !== 'object' || parsedValue === null) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `SSM parameter for ${configName} must contain a valid JSON object.`
        );
    }
    const val = parsedValue as Record<string, unknown>;
    const prop = (key: string) => val[key] as Record<string, unknown> | undefined;
    const arr = (key: string) => val[key] as Record<string, unknown>[] | undefined;

    switch (credentialType) {
        case 'fsx': {
            const fsx = prop('fsx');
            if (!fsx?.username || !fsx?.password) {
                throw createError(
                    HttpErrorCodes.BAD_REQUEST,
                    `SSM parameter for ${configName} must contain JSON: { "fsx": { "username": "...", "password": "..." } }`
                );
            }
            break;
        }
        case 'sql-mssql': {
            const sql = arr('sql');
            if (!isArray(sql) || sql.length === 0) {
                throw createError(
                    HttpErrorCodes.BAD_REQUEST,
                    `SSM parameter for ${configName} must contain JSON: { "sql": [{ "sqlinstancename": "...", "username": "...", "password": "..." }] }`
                );
            }
            for (const entry of sql) {
                if (!entry.sqlinstancename || !entry.username || !entry.password) {
                    throw createError(
                        HttpErrorCodes.BAD_REQUEST,
                        `Each SQL credential entry must have sqlinstancename, username, and password in ${configName}.`
                    );
                }
            }
            break;
        }
        case 'domain':
        case 'ad': {
            const domain = arr('domain');
            if (!isArray(domain) || domain.length === 0) {
                throw createError(
                    HttpErrorCodes.BAD_REQUEST,
                    `SSM parameter for ${configName} must contain JSON: { "domain": [{ "sqlinstancename": "...", "username": "...", "password": "..." }] }`
                );
            }
            for (const entry of domain) {
                if (!entry.sqlinstancename || !entry.username || !entry.password) {
                    throw createError(
                        HttpErrorCodes.BAD_REQUEST,
                        `Each domain credential entry must have sqlinstancename, username, and password in ${configName}.`
                    );
                }
            }
            break;
        }
        case 'oracle': {
            const oracle = arr('oracle');
            if (!isArray(oracle) || oracle.length === 0) {
                throw createError(
                    HttpErrorCodes.BAD_REQUEST,
                    `SSM parameter for ${configName} must contain JSON: { "oracle": [{ "oracleinstancename": "...", "username": "...", "password": "..." }] }`
                );
            }
            for (const entry of oracle) {
                if (!entry.oracleinstancename || !entry.username || !entry.password) {
                    throw createError(
                        HttpErrorCodes.BAD_REQUEST,
                        `Each Oracle credential entry must have oracleinstancename, username, and password in ${configName}.`
                    );
                }
            }
            break;
        }
        default: {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `Unsupported credential type: ${credentialType} for ${configName}`
            );
        }
    }
}

/**
 * Validates that a GovCloud deployment configuration contains proper ssmParameterArn
 * and that commercial accounts do not send ssmParameterArn.
 * Used as a pre-check in deployment route hooks.
 */
function validateDeploymentConfigSsmArn(
    configName: string,
    config: Record<string, unknown> | null | undefined,
    region?: string
): void {
    if (!config) {
        return;
    }

    const isGovAccount = getAsyncLocalStorageResource<boolean>(GOV_ACCOUNT);

    if (isGovAccount) {
        if (!config.ssmParameterArn) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `GovCloud accounts must provide ssmParameterArn in ${configName}.`
            );
        }
        if (config.password || config.domainPassword || config.fsxPassword || config.serviceAccountPassword) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `Password fields are not supported for GovCloud accounts in ${configName}. Provide ssmParameterArn instead.`
            );
        }
        validateSsmArnFormat(config.ssmParameterArn as string, configName, region);
    } else if (config.ssmParameterArn) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `ssmParameterArn is only supported for GovCloud accounts in ${configName}. Provide credentials directly instead.`
        );
    }
}

/**
 * Validates SSM ARN for the register flow credential entries.
 * Checks format, partition, region, path, and optionally existence + JSON structure.
 */
async function validateRegisterSsmArn(
    credentialsId: string,
    region: string,
    ssmParameterArn: string,
    resourceId: string,
    credentialType: CredentialType
): Promise<void> {
    const configName = `credential for ${resourceId}`;

    validateSsmArnFormat(ssmParameterArn, configName, region);

    const arnParts = ssmParameterArn.match(SSM_ARN_PATTERN);
    if (!arnParts) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `Invalid SSM parameter ARN format for ${configName}: ${ssmParameterArn}`
        );
    }
    const paramPath = arnParts[4];
    const parameterName = `/${paramPath}`;

    if (credentialType === 'fsx') {
        const arnFsxId = paramPath.split('/').pop();
        if (arnFsxId !== resourceId) {
            throw createError(
                HttpErrorCodes.BAD_REQUEST,
                `SSM parameter ARN references FSx '${arnFsxId}' but credential resourceId is '${resourceId}' in ${configName}. The FSx ID in the ARN path must match the resourceId.`
            );
        }
    }

    const paramValue = await getParameter(credentialsId, region, parameterName);
    if (!paramValue) {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `SSM parameter not found or not readable for ${configName}: ${parameterName}. Ensure the parameter exists and the credentials have access.`
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(paramValue);
    } catch {
        throw createError(
            HttpErrorCodes.BAD_REQUEST,
            `SSM parameter value is not valid JSON for ${configName}: ${parameterName}`
        );
    }

    validateCredentialJsonStructure(parsed, credentialType, configName);
}

export {
    SSM_ARN_PATTERN,
    validateSsmArnFormat,
    validateDeploymentConfigSsmArn,
    validateRegisterSsmArn,
    validateCredentialJsonStructure
};

export type { CredentialType };
