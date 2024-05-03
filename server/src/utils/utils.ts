/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import { attempt, trimEnd, trimStart, camelCase } from 'lodash-es';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Tag } from '@aws-sdk/client-ec2';
import createError from 'http-errors';
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
    FCI_NETWORK_ROUTE_TABLE_VIOLATION_MESSAGE,
    subJobDescriptions,
    SqlServerDeploymentModel,
    ARTIFACT_BUCKET_NAME,
    HttpErrorCodes,
    MAX_FSX_STORAGE_IN_GIB,
    FSX_VOL_THROUGHPUT,
    FSX_STORAGE_MIN_CAPACITY_IN_GIB
} from './consts';

import getLogger, { hideSecretsValues } from './logger';
import { CFNetworkConfigurationType } from '../routes/types/deployment.types';
import { MS_SQL_2016, MS_SQL_2017, MS_SQL_2022 } from '../operations/workloads/mssql/createdb-collations';

const logger = getLogger();

const subJobRegex = /-([^-\s]+)-[^-\s]+$/;
const subJobNames = ['SQLStandaloneStack', 'SQLServerStack', 'NewFSxStack', 'ExistingFSxStack'];

function filterSqlAmis(osVersion?: string, dbVersion?: string, dbEdition?: string) {
    logger.debug({ osVersion, dbEdition, dbVersion });
    return SQL_AMI_NAMES.filter(ami =>
        osVersion ? ami.toLowerCase().includes(`Windows_Server-${osVersion}`.toLowerCase()) : true
    )
        .filter(ami => (dbVersion ? ami.toLowerCase().includes(`SQL_${dbVersion}`.toLowerCase()) : true))
        .filter(ami => (dbEdition ? ami.toLowerCase().includes(dbEdition.toLowerCase()) : true));
}

function generateDeploymentParams(
    FSxDataLunSize: number,
    isExistingFSx: boolean,
    sqlDeploymentType: string = 'fci',
    fsxVolThroughput: number
) {
    logger.info('Generate deployment params', { FSxDataLunSize, isExistingFSx, sqlDeploymentType, fsxVolThroughput });

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
    } = calculateFsxnStorageCapacity(FSxDataLunSize);

    // If the FSX total storage crosses 192Tib Means keeping it to 192TiB (196608GiB). This is because when the 130TiB is given as a data lun size, total storage capacity of is going beyond 196608 which is 197695.
    const fsxStorageCapacity = Math.min(FSxStorageCapacity, MAX_FSX_STORAGE_IN_GIB);

    // To provision 4 GBps of throughput capacity, your file system must be configured with a minimum of 5,120 GiB of SSD storage capacity.
    // https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/performance.html
    if (fsxVolThroughput === FSX_VOL_THROUGHPUT && fsxStorageCapacity <= FSX_STORAGE_MIN_CAPACITY_IN_GIB) {
        throw createError(412, 'Supported Fsxn Storage Capactiy should be minumum of 5,120 GiB');
    }

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
        FSxStorageCapacity: fsxStorageCapacity,
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

function calculateFsxnStorageCapacity(fsxDataLunSize: number) {
    logger.info('Calculate FSX Netapp Storage capacity from the database size', { fsxDataLunSize });

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

    // 20 percent of FSxStorageCapacity
    let FSxBufferVolumeSize = 0;
    // FSxBufferVolumeSize in GiB initially later converted to MiB
    // If the total fsx storage capacity goes beyond 192TiB Means, we will keep the buffer as 0
    // Otherwise we will calculate the 20 percent of FSxStorageCapacity as the buffer, Even then if that buffer plus fsx storage capacity goes beyond total limit of 192TiB, then we keep the difference
    // between FSxStorageCapacity and Max FSX Storage limit as buffer
    if (FSxStorageCapacity < MAX_FSX_STORAGE_IN_GIB) {
        FSxBufferVolumeSize = Math.ceil(0.2 * FSxStorageCapacity);
        if (FSxStorageCapacity + FSxBufferVolumeSize >= MAX_FSX_STORAGE_IN_GIB) {
            FSxBufferVolumeSize = Math.ceil((MAX_FSX_STORAGE_IN_GIB - FSxStorageCapacity) * 1024);
            FSxStorageCapacity += FSxBufferVolumeSize / 1024;
        } else {
            FSxBufferVolumeSize = Math.ceil(FSxBufferVolumeSize * 1024);
            FSxStorageCapacity += FSxBufferVolumeSize / 1024;
        }
    }

    logger.debug('FSx Storage Capacity', { FSxStorageCapacity });

    return {
        FSxDataLunSizeInMib,
        FSxDataVolumeSize,
        FSxLogVolumeSize,
        FSxTempDbVolumeSize,
        FSxQuorumVolumeSize,
        FSxBufferVolumeSize,
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

// Return job decription for corresponding Job name
function getDescriptionForMatchingName(jobName: string, stackSqlDeploymentType: string) {
    logger.info('Return job decription for job name:', jobName);
    // ValidationStack1 is the only common stack between FCI and Standalone Deployment that has different description.
    // Diffrentiating between the deployment type to provide appropriate description.
    if (jobName.includes('ValidationStack1')) {
        const match = jobName.match(subJobRegex);
        jobName = match ? match[1] : '';
        jobName =
            stackSqlDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT
                ? jobName.concat('-fci')
                : jobName.concat('-standalone');
        return subJobDescriptions[jobName];
    }
    if (subJobNames.some(subJobName => jobName.indexOf(subJobName) !== -1)) {
        const match = jobName.match(subJobRegex);
        jobName = match ? match[1] : '';
        return subJobDescriptions[jobName];
    }

    let jobDescription = '';
    Object.keys(subJobDescriptions).forEach(key => {
        if (jobName.includes(key)) {
            jobDescription = subJobDescriptions[key];
        }
    });
    return jobDescription;
}

function convertMetricsIntoJson(input: Array<string>) {
    const metrics: { [key: string]: string } = {};

    for (const metric of input) {
        const [key, value] = metric.split(':');
        metrics[key] = value;
    }
    return metrics;
}

function getResourceNameFromTags(tags?: Tag[]) {
    const { Value: name } = tags?.find(tag => tag?.Key === 'Name') || {};
    return name;
}

function getArtifactsRegionBucketName(region: string) {
    return `${ARTIFACT_BUCKET_NAME.replace('REGION', region)}`;
}

function sqlResponseParsing(response: string) {
    try {
        const cleanResponse = response.replaceAll('\r\n', '');
        const jsonResponse = JSON.parse(cleanResponse);
        return jsonResponse;
    } catch (error) {
        logger.error('Error parsing query response:', response);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error parsing query response: ${response}`);
    }
}

function convertGiBToBytes(sizeInGiB: number) {
    return sizeInGiB * 1024 * 1024 * 1024;
}

function splitDomainUsername(input: string) {
    // Check for domainname/user
    const domainregex1 = /(?<domain>.*)[\\|/](?<username>.*)$/;
    // Check for user@domainname
    const domainregex2 = /(?<username>.*)@(?<domain>.*)$/;

    const details = domainregex1.test(input)
        ? domainregex1.exec(input)?.groups || { domain: '', username: input }
        : domainregex2.test(input)
        ? domainregex2.exec(input)?.groups || { domain: '', username: input }
        : { domain: '', username: input };

    return details;
}

function getCollationForMSSQLVersion(mssqlVersion: string, defaultCollation: string = 'SQL_Latin1_General_CP1_CI_AS') {
    // This regular expression matches four digits in a row, which is the pattern for a year.
    const regex = /\b\d{4}\b/;

    const [match] = mssqlVersion.match(regex) || [];
    switch (match) {
        case '2016':
            return {
                collationList: MS_SQL_2016,
                defaultCollation
            };
        case '2017':
            return {
                collationList: MS_SQL_2017,
                defaultCollation
            };
        case '2019':
        case '2022':
            return {
                collationList: MS_SQL_2022,
                defaultCollation
            };
        default:
            logger.error(`Unable to get collation information for the given MSSQL Version ${mssqlVersion}`);
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `Unable to get collation information for the given MSSQL Version ${mssqlVersion}`
            );
    }
}

function camelizeKeys(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(v => camelizeKeys(v));
    }
    if (obj != null && obj.constructor === Object) {
        return Object.keys(obj).reduce(
            (result: { [key: string]: any }, key: string) => ({
                ...result,
                [camelCase(key)]: camelizeKeys(obj[key])
            }),
            {}
        );
    }
    return obj;
}

function convertToBytes(size: number, unit: string) {
    const units: { [key: string]: number } = {
        B: 1,
        KiB: 1024 ** 1,
        MiB: 1024 ** 2,
        GiB: 1024 ** 3,
        TiB: 1024 ** 4,
        PiB: 1024 ** 5,
        EiB: 1024 ** 6,
        ZiB: 1024 ** 7,
        YiB: 1024 ** 8
    };

    return size * (units[unit] || 1);
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
    calculateFsxnStorageCapacity,
    sizeInGigaBytes,
    waitForResolution,
    deployedStackUrl,
    generateRandomIP,
    isActiveInstance,
    checkAccount,
    calculateSQLandWindowsVersion,
    getDescriptionForMatchingName,
    convertMetricsIntoJson,
    getResourceNameFromTags,
    getArtifactsRegionBucketName,
    sqlResponseParsing,
    convertGiBToBytes,
    splitDomainUsername,
    getCollationForMSSQLVersion,
    camelizeKeys,
    convertToBytes
};
