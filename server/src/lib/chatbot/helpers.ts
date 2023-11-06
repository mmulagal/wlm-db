import {
    validateDbSize,
    validateDomain,
    validateImageId,
    validateInstanceType,
    validateThroughPut,
    validateKeyName,
    validateRegion,
    validateText,
    validateVpcId,
    validateSecurityGroup,
    validateFSxDeploymentMode,
    validateCredentials,
    checkFsxType
} from './validator';
import getLogger from '../../utils/logger';
import {
    AD_SCENARIO_TYPE,
    AZ_1,
    AZ_2,
    CREDENTIALS_ID,
    DB_SIZE,
    DNS_IP,
    DOMAIN_DNS,
    DOMAIN_PASS,
    DOMAIN_USERNAME,
    FSX_DEPLOYMENT_MODE,
    FSX_IOPS,
    FSX_PASS,
    FSX_TYPE,
    FSX_USERNAME,
    FSX_VOL_THROUGHPUT,
    KEY_PAIR_NAME,
    ONTAP_SG_ID,
    REGION,
    SERVICE_ACCOUNT_NAME,
    SERVICE_ACCOUNT_PASS,
    SQL_AMI,
    SQL_DEPLOYMENT_MODE,
    VPC_CIDR,
    VPC_ID,
    WL_INSTANCE_TYPE
} from './consts';
import { SINGLE_AZ } from '../../utils/consts';

const logger = getLogger();

type ValidationResponse = {
    key?: string;
    status?: string;
    message?: string;
    allowedValues?: any;
    value?: any;
};

function findChangedKeys(params: Params, oldParams: Params) {
    const changedKeys = [];
    for (const key in params) {
        if (key in oldParams && oldParams[key] !== params[key]) {
            changedKeys.push(key);
        }
    }
    return changedKeys;
}

function resetNextParamsOnUpdate(schemaParams: any, params: Params, oldParams: Params, dependsOn: Set<string>) {
    for (const reqParam of schemaParams) {
        for (const key in reqParam) {
            if (Array.isArray(reqParam[key])) {
                resetNextParamsOnUpdate(reqParam[key], params, oldParams, dependsOn);
            } else if (dependsOn.has(reqParam[key].dependsOn) && params[key]) {
                dependsOn.add(key);
                delete params[key];
            }
        }
    }
}

interface Params {
    [x: string]: any;
}

async function validateParams(
    params: Params,
    oldParams: Params,
    schemaParams: any
): Promise<{ errors: Array<ValidationResponse>; params: Params }> {
    // let errors: { [x: string]: any } = {};
    logger.info('Validate Params', oldParams, { params, oldParams });
    let validatedParams: Params = {};
    const promises = [];
    const errors: Array<ValidationResponse> = [];
    for (const reqParam of schemaParams) {
        let response: ValidationResponse | { value: any } | undefined;
        if (reqParam.required !== false) {
            const keys = Object.keys(reqParam);
            for (const key of keys) {
                logger.debug('KEY>>>', key, reqParam[key]);

                if (Array.isArray(reqParam[key])) {
                    const recursiveValidationResponse = await validateParams(params, oldParams, reqParam[key]);
                    logger.debug('Response from Recursive Call>>>', response);
                    validatedParams = { ...validatedParams, ...recursiveValidationResponse?.params };
                    if (recursiveValidationResponse?.errors?.length) {
                        return { errors: recursiveValidationResponse.errors, params: validatedParams };
                    }
                } else if (checkIfRequired(reqParam[key].required, params)) {
                    promises.push(validate(key, params, oldParams, errors, validatedParams));
                }
            }
        }
    }
    await Promise.all(promises);
    return { errors, params: validatedParams };
}

function wrapContext(question: string) {
    return `\n\nHuman: ${question} \n\nAssistant:`;
}

function checkIfRequired(required: boolean | { key: string; value: string; operand: string }, params: Params) {
    if (typeof required === 'object') {
        const { key, value, operand } = required;

        switch (operand) {
            case 'EQ':
                return params[key] === value;
            default:
                return false;
        }
    }

    return !!required;
}

async function validate(
    key: string,
    params: Params,
    oldParams: Params,
    errors: Array<ValidationResponse>,
    validatedParams: Params
) {
    const shouldSkip = params?.[key] && oldParams?.[key] && oldParams[key] === params[key];
    logger.debug('skip check', shouldSkip);
    let response;
    if (!shouldSkip) {
        switch (key) {
            case CREDENTIALS_ID: {
                response = await validateCredentials(params[key], key);
                break;
            }
            case REGION: {
                response = await validateRegion(params.credentialsId, params[key], key);
                break;
            }
            case VPC_ID:
            case AZ_1:
            case AZ_2:
            case VPC_CIDR: {
                response = await validateVpcId(
                    params.credentialsId,
                    params.region,
                    params.vpcId,
                    params.availabilityZone1,
                    params.availabilityZone2,
                    key
                );
                break;
            }
            case WL_INSTANCE_TYPE: {
                response = await validateInstanceType(params.credentialsId, params.region, params[key], key);
                break;
            }
            case KEY_PAIR_NAME: {
                response = await validateKeyName(params.credentialsId, params.region, params[key], key);
                break;
            }
            case SQL_AMI: {
                response = await validateImageId(params.credentialsId, params.region, params[key], key);
                break;
            }
            case AD_SCENARIO_TYPE:
            case DNS_IP:
            case DOMAIN_DNS: {
                response = await validateDomain(
                    params.credentialsId,
                    params.region,
                    params.domainDnsname,
                    params[DNS_IP],
                    key
                );
                break;
            }
            case DOMAIN_USERNAME:
            case DOMAIN_PASS:
            case FSX_USERNAME:
            case FSX_PASS:
            case SERVICE_ACCOUNT_NAME:
            case SERVICE_ACCOUNT_PASS: {
                response = validateText(params[key], key);
                break;
            }
            case FSX_DEPLOYMENT_MODE: {
                response = await validateFSxDeploymentMode(params[key], key);
                break;
            }
            case SQL_DEPLOYMENT_MODE: {
                response = { value: params[FSX_DEPLOYMENT_MODE] === SINGLE_AZ ? 'standalone' : 'fci' };
                break;
            }
            case DB_SIZE: {
                response = validateDbSize(params[key], key);
                break;
            }
            case FSX_VOL_THROUGHPUT: {
                response = validateThroughPut(params[key], key);
                break;
            }
            case FSX_IOPS: {
                response = { value: 3 * params.databaseSize };
                break;
            }
            case ONTAP_SG_ID: {
                response = await validateSecurityGroup(
                    params.credentialsId,
                    params.region,
                    params.vpcId,
                    params[key],
                    key
                );
                break;
            }
            case FSX_TYPE: {
                response = checkFsxType(params[key], key);
                break;
            }
            default:
        }
    } else {
        validatedParams[key] = params[key];
    }
    if ((response as ValidationResponse)?.status === 'error') {
        delete params[key];
        errors.push(response as ValidationResponse);
    }

    if (response?.value) {
        validatedParams[key] = response?.value;
        params[key] = response?.value;
    }
}

export { validateParams, resetNextParamsOnUpdate, wrapContext, findChangedKeys };
