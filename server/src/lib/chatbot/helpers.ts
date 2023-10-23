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
    validateCredentials
} from './validator';
import getLogger from '../../utils/logger';

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

function resetNextParamsOnUpdate(requiredParams: any, params: Params, oldParams: Params, dependsOn: Set<string>) {
    for (const reqParam of requiredParams) {
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
    requiredParams: any
): Promise<{ errors: Array<ValidationResponse>; params: Params }> {
    // let errors: { [x: string]: any } = {};
    let validatedParams: Params = {};
    const errors: Array<ValidationResponse> = [];
    for (const reqParam of requiredParams) {
        let response: ValidationResponse | { value: any } | undefined;

        if (reqParam.required) {
            const keys = Object.keys(reqParam);
            for (const key of keys) {
                logger.debug('KEY>>>', key, reqParam[key]);
                // if (reqParam[key].required === false) {
                //     continue;
                // }

                if (Array.isArray(reqParam[key])) {
                    const recursiveValidationResponse = await validateParams(params, oldParams, reqParam[key]);
                    // validatedParams[key] = response;
                    logger.debug('Response from Recursive Call>>>', response);
                    // if (response.params) {
                    // validatedParams.push(...response?.params);
                    // }
                    validatedParams = { ...validatedParams, ...recursiveValidationResponse?.params };
                    if (recursiveValidationResponse?.errors?.length) {
                        errors.push(...recursiveValidationResponse.errors);
                        // break;
                        return { errors, params: validatedParams };
                    }
                    // return { errors, params: validatedParams };
                    // else if (response?.value) {
                    // }
                } else if (checkIfRequired(reqParam[key].required, params)) {
                    // logger.debug('CHECK FOR SKIPPING>>', key, params[key], oldParams?.[key]);
                    const shouldSkip = params?.[key] && oldParams?.[key] && oldParams[key] === params[key];
                    logger.debug('skip check', shouldSkip);
                    if (!shouldSkip) {
                        switch (key) {
                            case 'credentialsId': {
                                response = await validateCredentials(params[key]);
                                break;
                            }
                            case 'region': {
                                response = await validateRegion(params.credentialsId, params[key]);
                                break;
                            }
                            case 'vpcId':
                            case 'availabilityZone1':
                            case 'availabilityZone2':
                            case 'vpcCidr': {
                                response = await validateVpcId(
                                    params.credentialsId,
                                    params.region,
                                    params.vpcId,
                                    key,
                                    params[key]
                                );
                                break;
                            }
                            // case 'securityGroup': {
                            //     response = await validateSecurityGroup(params.region, params[key]);
                            //     break;
                            // }
                            case 'workloadInstanceType': {
                                response = await validateInstanceType(params.credentialsId, params.region, params[key]);
                                break;
                            }
                            case 'keyPairName': {
                                response = await validateKeyName(params.credentialsId, params.region, params[key]);
                                break;
                            }
                            case 'sqlAmiId': {
                                response = await validateImageId(params.credentialsId, params.region, params[key]);
                                break;
                            }
                            case 'adScenarioType': {
                                response = { value: 'AWS_MANAGED_AD' };
                                break;
                            }
                            case 'dnsIpaddress':
                            case 'domainDnsname': {
                                response = await validateDomain(
                                    params.credentialsId,
                                    params.region,
                                    params.domainDnsname,
                                    key
                                );
                                break;
                            }
                            case 'domainUsername':
                            case 'domainPassword':
                            case 'fsxUsername':
                            case 'fsxPassword':
                            case 'serviceAccountName':
                            case 'serviceAccountPassword':
                            case 'sqlFciName': {
                                response = validateText(params[key], key);
                                break;
                            }
                            case 'fsxDeploymentMode': {
                                response = await validateFSxDeploymentMode(params[key]);
                                break;
                            }
                            case 'sqlDeploymentMode': {
                                response = { value: 'standalone' };
                                break;
                            }
                            case 'databaseSize': {
                                response = validateDbSize(params[key]);
                                break;
                            }
                            case 'fsxVolThroughput': {
                                response = validateThroughPut(params[key]);
                                break;
                            }
                            case 'fsxIOPS': {
                                response = { value: 3 * params.databaseSize };
                                break;
                            }
                            case 'ontapSgGroupId': {
                                response = await validateSecurityGroup(
                                    params.credentialsId,
                                    params.region,
                                    params.vpcId,
                                    params[key]
                                );
                                break;
                            }
                            // case 'keyPairName': {
                            //     response = await validateKeyName;
                            // }
                            default:
                        }
                    } else {
                        validatedParams[key] = params[key];
                    }
                    if ((response as ValidationResponse)?.status === 'error') {
                        delete params[key];
                        // return response;
                        errors.push(response as ValidationResponse);
                    }

                    if (response?.value) {
                        validatedParams[key] = response?.value;
                        params[key] = response?.value;
                    }
                }
            }
        }
        // logger.debug({ params, response });
    }
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

export { validateParams, resetNextParamsOnUpdate, wrapContext, findChangedKeys };
