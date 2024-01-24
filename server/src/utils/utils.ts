/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import { attempt, trimEnd, trimStart } from 'lodash-es';
import jwt from 'jsonwebtoken';
import crypto, { randomUUID } from 'crypto';
import { getAsyncLocalStorageResource } from './async-local-storage';

import {
    SQL_AMI_NAMES,
    WLMDB,
    USER_TOKEN,
    DEFAULT_AWS_REGION,
    FSX_SSD_MIN_SIZE,
    FSX_SSD_MAX_SIZE,
    FCI_STACKNAME,
    STANDALONE_STACKNAME,
    STANDALONE,
    STANDALONE_NETWORK_VIOLATION_MESSAGE,
    FCI_NETWORK_EMPTY_VIOLATION_MESSAGE,
    FCI_NETWORK_ROUTE_TABLE_VIOLATION_MESSAGE
} from './consts';

import getLogger, { hideSecretsValues } from './logger';
import { CFNetworkConfigurationType } from '../routes/types/deployment.types';
import {
    fsxStackData,
    masterStackData,
    sqlFciServerStackData,
    sqlStandaloneStackData,
    validationStack1Data,
    validationStack2Data
} from './job-monitoring-mockdata';

const logger = getLogger();

function filterSqlAmis(osVersion?: string, dbVersion?: string, dbEdition?: string) {
    logger.debug({ osVersion, dbEdition, dbVersion });
    return SQL_AMI_NAMES.filter(ami =>
        osVersion ? ami.toLowerCase().includes(`Windows_Server-${osVersion}`.toLowerCase()) : true
    )
        .filter(ami => (dbVersion ? ami.toLowerCase().includes(`SQL_${dbVersion}`.toLowerCase()) : true))
        .filter(ami => (dbEdition ? ami.toLowerCase().includes(dbEdition.toLowerCase()) : true));
}

function generateDeploymentParams(FSxDataLunSize: number, isExistingFSx: boolean, sqlDeploymentType: string = 'fci') {
    const prefix = WLMDB;
    const suffix = Date.now();
    const randomDigits = generateRandomNumberInRange(10000, 99999);

    const {
        FSxDataLunSizeInMib,
        FSxDataVolumeSize,
        FSxLogVolumeSize,
        FSxTempDbVolumeSize,
        FSxQuorumVolumeSize,
        FSxStorageCapacity
    } = calculateFsxStorageCapacity(FSxDataLunSize);

    const stacknameSubstring = sqlDeploymentType === 'fci' ? FCI_STACKNAME : STANDALONE_STACKNAME;
    const netbios =
        sqlDeploymentType === 'fci'
            ? [`sqlnode1-${randomDigits}`, `sqlnode2-${randomDigits}`]
            : [`sqlnode-${randomDigits}`];

    let params = {
        UniqueID: suffix,
        StackName: `${prefix.toUpperCase()}-${stacknameSubstring}-${suffix}`,
        // VpcName: `${prefix}-vpc-${suffix}`,
        FSxFileSystemName: isExistingFSx ? '' : `${prefix}-fsx-${suffix}`,
        FSxDataVolumeName: `${prefix}_sqldata_${suffix}`,
        FSxDataVolumeSize,
        FSxLogVolumeName: `${prefix}_sqllog_${suffix}`,
        FSxLogVolumeSize, // 25% of FSxDataVolumeSize
        FSxTempDbVolumeName: `${prefix}_sqltemp_${suffix}`,
        FSxTempDbVolumeSize, // 10% of FSxDataVolumeSize
        FSxSvmName: `${prefix}_svm_${suffix}`,
        SQLigroupname: `${prefix}_sqligroup_${suffix}`,
        SQLSvmName: `${prefix}_sqlsvm_${suffix}`,
        NodeNetBIOSNames: netbios,
        FSxStorageCapacity,
        FSxDataLunSize: FSxDataLunSizeInMib
    };
    if (sqlDeploymentType === 'fci') {
        params = {
            ...params,
            ...{
                SqlFSxWSFCName: `WLMWSFC-${randomDigits}`,
                FSxQuorumVolumeName: `${prefix}_quorum_${suffix}`,
                FSxQuorumVolumeSize
            }
        };
    }
    return params;
}

function calculateFsxStorageCapacity(fsxDataLunSize: number) {
    logger.info('Calculate FSX Storage capacity from the database size', { fsxDataLunSize });

    const FSxDataLunSizeInMib = fsxDataLunSize * 1024;

    // All these in MiB
    const FSxDataVolumeSize = Math.ceil(1.1 * FSxDataLunSizeInMib); // FSxDataLunSize + 10% of FSxDataLunSize
    const FSxLogVolumeSize = Math.ceil(0.25 * FSxDataVolumeSize); // 25% of FSxDataVolumeSize
    const FSxTempDbVolumeSize = Math.ceil(0.1 * FSxDataVolumeSize); // 10% of FSxDataVolumeSize
    const FSxQuorumVolumeSize = 12000; // 12GB

    // StorageCapacity in GiB
    let FSxStorageCapacity = Math.ceil(
        (FSxDataVolumeSize + FSxLogVolumeSize + FSxTempDbVolumeSize + FSxQuorumVolumeSize) / 1024
    );

    FSxStorageCapacity = Math.max(FSxStorageCapacity, FSX_SSD_MIN_SIZE);
    FSxStorageCapacity = Math.min(FSxStorageCapacity, FSX_SSD_MAX_SIZE);

    logger.debug('FSx Storage Capacity', { FSxStorageCapacity });

    return {
        FSxDataLunSizeInMib,
        FSxDataVolumeSize,
        FSxLogVolumeSize,
        FSxTempDbVolumeSize,
        FSxQuorumVolumeSize,
        FSxStorageCapacity
    };
}

function generateRandomNumberInRange(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

// Get xAgentId from bearer token
function getSubjectFromBearerToken() {
    const token = getAsyncLocalStorageResource<string>(USER_TOKEN);
    const tokenWithoutBearerPrefix = trimStart(token, 'Bearer').trim();
    const tokenWithoutBearerSuffix = trimEnd(tokenWithoutBearerPrefix, 'clients').trim();
    const decodedToken = jwt.decode(tokenWithoutBearerSuffix, { complete: true });
    return decodedToken?.payload.sub;
}

function isNetworkConfigurationViolated(networkConfiguration: CFNetworkConfigurationType, deploymentMode: string) {
    const noViolation = { isViolated: false };

    if (deploymentMode === STANDALONE) {
        if (!networkConfiguration.privateSubnet1Id || !networkConfiguration.routeTable1Id) {
            return {
                isViolated: true,
                violationMessage: STANDALONE_NETWORK_VIOLATION_MESSAGE
            };
        }
        return noViolation;
    }
    if (
        !networkConfiguration.privateSubnet1Id ||
        !networkConfiguration.privateSubnet2Id ||
        !networkConfiguration.routeTable1Id ||
        !networkConfiguration.routeTable2Id
    ) {
        return {
            isViolated: true,
            violationMessage: FCI_NETWORK_EMPTY_VIOLATION_MESSAGE
        };
    }

    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        return noViolation;
    }

    if (networkConfiguration.routeTable1Id === networkConfiguration.routeTable2Id) {
        return {
            isViolated: true,
            violationMessage: FCI_NETWORK_ROUTE_TABLE_VIOLATION_MESSAGE
        };
    }
    return noViolation;
}

function checkAndRetrieveJsonObject(str: string | undefined) {
    try {
        if (str) {
            const result = attempt(JSON.parse, str);
            if (result instanceof Error) {
                return { isValid: false };
            }
            return { isValid: true, message: result };
        }
        return { isValid: false };
    } catch (err) {
        return { isValid: false };
    }
}

function getQueueArn(accountId: string, queueName: string) {
    return `arn:aws:sqs:${DEFAULT_AWS_REGION}:${accountId}:${queueName}`;
}

function getSnsArn(accountId: string, region: string, snsName: string) {
    return `arn:aws:sns:${region}:${accountId}:${snsName}`;
}

function getFsxArn(awsAccountId: string, region: string, fsxId: string) {
    return `arn:aws:fsx:${region}:${awsAccountId}:file-system/${fsxId}`;
}

function getQueueUrl(accountId: string, queueName: string) {
    return `https://sqs.${DEFAULT_AWS_REGION}.amazonaws.com/${accountId}/${queueName}`;
}

function derivePropertiesFromARN(awsResourceArn: string) {
    const ARN_FORMAT = /arn:aws:(?<awsServiceName>.+):(?<region>.*):(?<awsAccountId>.+):(?<resourceName>.+)/;
    if (ARN_FORMAT.test(awsResourceArn)) {
        const matchResult = awsResourceArn.match(ARN_FORMAT);
        if (matchResult && matchResult.groups) {
            const { awsServiceName, region, awsAccountId, resourceName } = matchResult.groups;

            return {
                awsServiceName,
                region,
                awsAccountId,
                resourceName
            };
        }
    }
}

async function sleep(ms: number) {
    await new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function generateHash(value: string) {
    const hash = crypto.createHash('sha256');
    hash.update(value);
    return hash.digest('hex');
}

function sizeInGigaBytes(size: number, currentUnit: string = 'MB') {
    logger.debug('Converting size to GiB', { size });

    if (Number.isNaN(size)) {
        return 0;
    }

    switch (currentUnit.toLocaleUpperCase()) {
        case 'MB':
        case 'MIB':
            return size / 1024;
        default:
            return size;
    }
}

/**
 *
 * @param fn - function that returns a boolean when the response is correct
 * @param delay - interval after which the function should be invoked
 * @param maxDelay - total delay or timeout, if the function is not resolved within this time, we consider it a failure
 * @returns Promise that can be awaited
 */

function waitForResolution(fn: () => boolean, delay: number, maxDelay: number) {
    return Promise.race([
        sleep(maxDelay),
        new Promise(res => {
            const interval = setInterval(async () => {
                const result = fn();
                if (result) {
                    clearInterval(interval);
                    return res(true);
                }
            }, delay);
        })
    ]);
}

const deployedStackUrl = (region: string, stackId: string) =>
    `https://console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/stackinfo?stackId=${stackId}`;

function generateRandomIP(): string {
    const randomOctet = () => Math.floor(Math.random() * 256);
    const ip = `${randomOctet()}.${randomOctet()}.${randomOctet()}.${randomOctet()}`;
    return ip;
}

function isActiveInstance() {
    return !process.env.hasOwnProperty('isActive') || process.env.isActive === 'true';
}

// To differentiate the users in the DEMO Mode, we are keeping accountId as accountId_UserId in the database
// So while saving & retrieving we have to maintain the same in demo mode
function checkAccount(accountId: string) {
    logger.info('checking account id', accountId);
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        const userId = getSubjectFromBearerToken();
        return userId ? `${accountId}_${userId}` : accountId;
    }
    return accountId;
}

async function createJobMockData(
    accountId: string,
    resourceName: string,
    stackName: string,
    sqlDeploymentMode: string,
    fsxFileSystemId: string | undefined,
    cloudProviderId: string,
    region: string
) {
    logger.info('Generate mock data for job table', accountId, resourceName, stackName);
    accountId = checkAccount(accountId);
    const masterStackId = randomUUID();
    const serverStackId = randomUUID();
    const fsxStackId = randomUUID();
    const validationStack1Id = randomUUID();
    const validationStack2Id = randomUUID();

    const data: any[] = [];

    const fsxType = fsxFileSystemId ? 'ExistingFSxStack' : 'NewFSxStack';

    data.push(
        ...masterStackData(accountId, resourceName, stackName, masterStackId),
        ...fsxStackData(
            accountId,
            resourceName,
            stackName,
            fsxStackId,
            masterStackId,
            cloudProviderId,
            fsxType,
            region
        ),
        ...validationStack1Data(
            accountId,
            resourceName,
            stackName,
            validationStack1Id,
            masterStackId,
            cloudProviderId,
            region
        )
    );
    if (sqlDeploymentMode.toLowerCase() === 'fci') {
        data.push(
            ...sqlFciServerStackData(accountId, resourceName, stackName, serverStackId, masterStackId),
            ...validationStack2Data(
                accountId,
                resourceName,
                stackName,
                validationStack2Id,
                masterStackId,
                cloudProviderId,
                region
            )
        );
    } else {
        data.push(
            ...sqlStandaloneStackData(
                accountId,
                resourceName,
                stackName,
                serverStackId,
                masterStackId,
                cloudProviderId,
                region
            )
        );
    }
    return data;
}
function calculateSQLandWindowsVersion(sqlAmiName: string) {
    logger.info('Calculate sql and windows version from the sql AMI name', sqlAmiName);

    // Regex Pattern
    const windowsVersionPattern = /Windows_Server-(\d+)/;
    const sqlVersionPattern = /SQL_(\d+)_([^+]+)/;

    // Extract Windows Version
    const windowsVersionMatch = sqlAmiName.match(windowsVersionPattern);
    const windowsVersion = windowsVersionMatch ? windowsVersionMatch[1] : '';

    // Extract SQL version and SQL version type
    const sqlVersionMatch = sqlAmiName.match(sqlVersionPattern);
    const sqlVersion = sqlVersionMatch ? sqlVersionMatch[1] : '';
    const sqlVersionType = sqlVersionMatch ? sqlVersionMatch[2] : '';

    return [windowsVersion, sqlVersion, sqlVersionType];
}

export {
    filterSqlAmis,
    generateDeploymentParams,
    getSubjectFromBearerToken,
    hideSecretsValues,
    isNetworkConfigurationViolated,
    checkAndRetrieveJsonObject,
    getQueueArn,
    getQueueUrl,
    derivePropertiesFromARN,
    sleep,
    getSnsArn,
    getFsxArn,
    generateHash,
    calculateFsxStorageCapacity,
    sizeInGigaBytes,
    waitForResolution,
    deployedStackUrl,
    generateRandomIP,
    isActiveInstance,
    checkAccount,
    createJobMockData,
    calculateSQLandWindowsVersion
};
