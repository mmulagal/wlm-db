/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import { attempt, trimEnd, trimStart, camelCase, isEmpty, isObject } from 'lodash-es';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import CIDR from 'ip-cidr';
import archiver from 'archiver';
import { Tag } from '@aws-sdk/client-ec2';
import createError from 'http-errors';
import numeral from 'numeral';
import isBase64 from 'is-base64';
import { gzipSync, inflateRaw } from 'node:zlib';
import { promisify } from 'util';
import randomize from 'randomatic';
import { StringValue } from 'ms';
import IORedis from 'ioredis';
import { StandardUnit } from '@aws-sdk/client-cloudwatch';
import { STORAGE_TYPE } from '@prisma/client';
import { SendCommandCommandInput } from '@aws-sdk/client-ssm';
import { getAsyncLocalStorageResource } from './async-local-storage';
import { RegionDetailsType } from '../routes/types/generic.types';

import {
    SQL_AMI_NAMES,
    WLMDB,
    USER_TOKEN,
    DEFAULT_AWS_REGION,
    FSX_SSD_MIN_SIZE,
    FCI_STACKNAME,
    STANDALONE_STACKNAME,
    STANDALONE,
    STANDALONE_NETWORK_VIOLATION_MESSAGE,
    FCI_NETWORK_EMPTY_VIOLATION_MESSAGE,
    SqlServerDeploymentModel,
    ARTIFACT_BUCKET_NAME,
    HttpErrorCodes,
    MAX_FSX_STORAGE_IN_GIB,
    FSX_VOL_THROUGHPUT,
    FSX_STORAGE_MIN_CAPACITY_IN_GIB,
    HOURS_IN_MONTH,
    DEFAULT_MSSQL_INSTANCE_NAME,
    DEFAULT_INSTANCE_NAME,
    SECRETS,
    DatabaseTypes,
    MAX_DATA_LUN_SIZE_IN_GIB,
    PERMISSIONS_TO_IGNORE_FOR_DEPLOYMENT,
    AWS_REGIONS,
    RESOURCESTYPE,
    HA,
    FCI,
    CLOUD_WATCH_METRICS_PERFORMANCE_METRIC_NAMES,
    CLOUD_WATCH_METRICS_PERFORMANCE_NAMESPACE,
    NOT_AVAILABLE,
    SSM_COMMAND_COMPRESSION_THRESHOLD
} from './consts';

import getLogger, { hideSecretsValues } from './logger';
import { CFNetworkConfigurationType } from '../routes/types/deployment.types';
import { MS_SQL_2016, MS_SQL_2017, MS_SQL_2022 } from '../operations/workloads/mssql/createdb-collations';
import { MIN_OPTIMIZED_HEADROOM_PERCENTAGE, REDIS_SCHEMA, REDIS_URL } from './continous-optimization-consts';
import { readFromCacheByKey, writeToCache } from './cache';
import { DatabaseInstance, DatabaseInstances, DatabaseInstancesIncludingResource, Resource } from './common-types';
import { SSM_RUN_SHELL_SCRIPT_DOC } from '../operations/workloads/oracle/consts';
import { SSM_RUN_POWERSHELL_SCRIPT_DOC } from '../operations/workloads/mssql/const';
import { BASH_DECOMPRESS_TEMPLATE } from '../operations/workloads/oracle/oracle-ssm-script-utils';
import { POWERSHELL_DECOMPRESS_TEMPLATE } from '../operations/workloads/mssql/common-templates';

const logger = getLogger();

const subJobRegex = /-([^-\s]+)-[^-\s]+$/;
const subJobNames = ['SQLStandaloneStack', 'SQLServerStack', 'NewFSxStack', 'ExistingFSxStack'];

type SubJobDescriptions = {
    [key: string]: string;
};

function filterSqlAmis(osVersion?: string, dbVersion?: string, dbEdition?: string) {
    logger.debug({ osVersion, dbEdition, dbVersion });
    return SQL_AMI_NAMES.filter(ami =>
        osVersion ? ami.toLowerCase().includes(`Windows_Server-${osVersion}`.toLowerCase()) : true
    )
        .filter(ami => (dbVersion ? ami.toLowerCase().includes(`SQL_${dbVersion}`.toLowerCase()) : true))
        .filter(ami => (dbEdition ? ami.toLowerCase().includes(dbEdition.toLowerCase()) : true));
}

function generateDeploymentParams(
    databaseType: string,
    fsxDataLunSize: number,
    isExistingFSx: boolean,
    sqlDeploymentType: string = 'fci',
    fsxVolThroughput: number,
    fsxIOPS: number
) {
    logger.info('Generate deployment params', {
        databaseType,
        fsxDataLunSize,
        isExistingFSx,
        sqlDeploymentType,
        fsxVolThroughput,
        fsxIOPS
    });

    const prefix = WLMDB;
    const suffix = Date.now();
    const randomDigits = generateRandomNumberInRange(10000, 99999);
    const randomDigitsUpto4 = generateRandomNumberInRange(1000, 9999);

    if (fsxDataLunSize > MAX_DATA_LUN_SIZE_IN_GIB) {
        // With 35% headroom and 15% for log and temp volumes, we can't go beyond 86TiB, given the max fsxn storage capacity is 192TiB
        throw createError(412, `FSx Data LUN Size should be less than or equal to ${MAX_DATA_LUN_SIZE_IN_GIB} GiB`);
    }

    const {
        FSxDataLunSizeInMib,
        FSxDataVolumeSize,
        FSxLogVolumeSize,
        FSxTempDbVolumeSize,
        FSxQuorumVolumeSize,
        FSxStorageCapacity
    } = calculateFsxnStorageCapacity(fsxDataLunSize, sqlDeploymentType, databaseType);

    // If the FSX total storage crosses 192Tib Means keeping it to 192TiB (196608GiB). This is because when the 130TiB is given as a data lun size, total storage capacity of is going beyond 196608 which is 197695.
    const fsxStorageCapacity = Math.min(FSxStorageCapacity, MAX_FSX_STORAGE_IN_GIB);

    // To provision 4 GBps of throughput capacity, your file system must be configured with a minimum of 5,120 GiB of SSD storage capacity.
    // https://docs.aws.amazon.com/fsx/latest/ONTAPGuide/performance.html
    if (fsxVolThroughput === FSX_VOL_THROUGHPUT && fsxStorageCapacity <= FSX_STORAGE_MIN_CAPACITY_IN_GIB) {
        throw createError(412, 'Supported FSx for ONTAP Storage Capactiy should be minumum of 5,120 GiB');
    }

    // If the fsx throughput selected as 4 GBps means, file system must be configured with 160,000 SSD IOPS.
    // Automatic (3 IOPS per GiB of SSD storage)
    // User-Provisioned (it should be calculated by 3 times of fsxStorageCapacity as minimum size)
    if (fsxIOPS !== 3 && fsxVolThroughput !== FSX_VOL_THROUGHPUT && !isExistingFSx) {
        // accepted iops values
        const acceptedIOPS = fsxStorageCapacity * 3;
        // Adding a buffer of 100 bytes to handle rounding off mismatch
        if (fsxIOPS < acceptedIOPS - 100) {
            throw createError(412, `Provisioned SSD IOPS should be at least ${acceptedIOPS}`);
        }
        if (fsxIOPS < 3072 || fsxIOPS > 80000) {
            throw createError(412, 'Provisioned SSD IOPS should be between 3072 and 80000');
        }
    }

    const stacknameSubstring = `${
        databaseType === DatabaseTypes.MS_SQL_SERVER
            ? sqlDeploymentType === 'fci'
                ? FCI_STACKNAME
                : STANDALONE_STACKNAME
            : databaseType === DatabaseTypes.PG_SQL
            ? sqlDeploymentType === 'ha'
                ? 'PgSqlHAStack'
                : `Pg${STANDALONE_STACKNAME}`
            : ''
    }`;
    const netbios =
        sqlDeploymentType === 'fci'
            ? [`sqlnode1-${randomDigits}`, `sqlnode2-${randomDigits}`]
            : [`sqlnode-${randomDigits}`];
    const netbiosPgsql =
        sqlDeploymentType === 'ha'
            ? [`pgsqlnode1-${randomDigitsUpto4}`, `pgsqlnode2-${randomDigitsUpto4}`]
            : [`pgsqlnode-${randomDigitsUpto4}`];

    let params = {
        UniqueID: suffix,
        StackName: `${prefix.toUpperCase()}-${stacknameSubstring}-${suffix}`,
        // VpcName: `${prefix}-vpc-${suffix}`,
        FSxFileSystemName: isExistingFSx ? '' : `${prefix}-fsx-${suffix}`,
        FSxDataVolumeName: `${prefix}_${databaseType === DatabaseTypes.PG_SQL ? 'pg' : ''}sqldata_${suffix}`,
        FSxDataVolumeSize,
        FSxLogVolumeName: `${prefix}_${databaseType === DatabaseTypes.PG_SQL ? 'pg' : ''}sqllog_${suffix}`,
        FSxLogVolumeSize, // 25% of FSxDataVolumeSize
        FSxSvmName: `${prefix}_svm_${suffix}`,
        SQLSvmName: `${prefix}_${databaseType === DatabaseTypes.PG_SQL ? 'pg' : ''}sqlsvm_${suffix}`,
        FSxStorageCapacity: fsxStorageCapacity,
        NodeNetBIOSNames: databaseType === DatabaseTypes.PG_SQL ? netbiosPgsql : netbios,
        ...(databaseType === DatabaseTypes.MS_SQL_SERVER && {
            FSxDataLunSize: FSxDataLunSizeInMib,
            SQLigroupname: `${prefix}_sqligroup_${suffix}`,
            FSxTempDbVolumeName: `${prefix}_sqltemp_${suffix}`,
            FSxTempDbVolumeSize // 10% of FSxDataVolumeSize
        })
    };

    if (sqlDeploymentType === 'fci' && databaseType === DatabaseTypes.MS_SQL_SERVER) {
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

function fsxStorageCapacityBreakdown(fsxStorageCapacity: number, sqlDeploymentMode: string) {
    logger.info('FSx Storage Capacity Breakdown', { fsxStorageCapacity, sqlDeploymentMode });

    fsxStorageCapacity = Math.max(fsxStorageCapacity, convertGiBToBytes(FSX_SSD_MIN_SIZE));
    fsxStorageCapacity = Math.min(fsxStorageCapacity, convertGiBToBytes(MAX_FSX_STORAGE_IN_GIB));

    logger.info('FSx Storage Capacity', { fsxStorageCapacity });
    /*
        -- This is for previous calculation --
        fsxCapacity = fsxDataVolumeSize + fsxLogVolumeSize + fsxTempDbVolumeSize + fsxQuorumVolumeSize
        fsxBuffer = 20% of fsxCapacity
        fsxStorageCapacity = fsxCapacity + fsxBuffer = fsxCapacity + 20% of fsxCapacity = 1.2 * fsxCapacity
        fsxCapacity = fsxStorageCapacity / 1.2
        fsxBuffer = (0.2) * fsxStorageCapacity/1.2
    */

    const fsxBufferVolumeSize = Math.ceil(fsxStorageCapacity * 0.35); // 35% of FSxStorageCapacity
    // if (fsxStorageCapacity + fsxBufferVolumeSize >= convertGiBToBytes(MAX_FSX_STORAGE_IN_GIB)) {
    //     fsxBufferVolumeSize = Math.ceil(convertGiBToBytes(MAX_FSX_STORAGE_IN_GIB) - fsxStorageCapacity);
    // }
    /*

    FSxStorageCapacity = FSxDataVolumeSize + FSxLogVolumeSize + FSxTempDbVolumeSize + FSxQuorumVolumeSize + FsxBufferVolumeSize

    fsxDataVolumeSize = FSxDataLunSize + 10% of FSxDataLunSize = 1.1 fsxLunSize
    FSxLogVolumeSize = 25% of fsxDataVolumeSize = 0.25 * 1.1 fsxLunSize
    FSxTempDbVolumeSize = 10% of fsxDataVolumeSize = 0.1 * 1.1 fsxLunSize
    FSxQuorumVolumeSize = 12GB || O GB(for Standalone)

    fsxDataVolumeSize = 1.1 fsxLunSize

    fsxStorageCapacity = (1.1 * fsxLunSize) + 0.25 * (1.1 * fsxLunSize) + 0.1 * (1.1 * fsxLunSize) + 12GB || 0 GB(for Standalone) + fsxBufferVolumeSize = (1.1 + 0.275 + 0.11) fsxLunSize + 12 || 0 GB + fsxBufferVolumeSize
    fsxStorageCapacity = 1.485 fsxLunSize + fsxQuorumVolumeSize + fsxBufferVolumeSize
    fsxLunSize = (fsxStorageCapacity - fsxQuorumVolumeSize - fsxBufferVolumeSize) / 1.485
    */

    const fsxQuorumVolumeSize = sqlDeploymentMode === STANDALONE ? 0 : 12 * 1000 * 1000 * 1000; // in calculateFsxnStorageCapacity FSxQuorumVolumeSize = 12000(MB); // 12GB

    const fsxStorageCapacityWithoutBuffer = fsxStorageCapacity - fsxBufferVolumeSize;
    const fsxDataLunSize = Math.ceil((fsxStorageCapacityWithoutBuffer - fsxQuorumVolumeSize) / 1.485);

    const fsxDataVolumeSize = Math.ceil(1.1 * fsxDataLunSize);
    const fsxLogVolumeSize = Math.ceil(0.25 * fsxDataVolumeSize);
    const fsxTempDbVolumeSize = Math.ceil(0.1 * fsxDataVolumeSize);

    return {
        fsxDataLunSize,
        fsxDataVolumeSize,
        fsxLogVolumeSize,
        fsxTempDbVolumeSize,
        fsxQuorumVolumeSize,
        fsxBufferVolumeSize,
        fsxStorageCapacity
    };
}

function calculateFsxnStorageCapacity(fsxDataLunSize: number, sqlDeploymentMode: string, databaseType?: string) {
    logger.info('Calculate FSX Netapp Storage capacity from the database size', {
        fsxDataLunSize,
        sqlDeploymentMode,
        databaseType
    });

    const FSxDataLunSizeInMib = fsxDataLunSize * 1024;

    // All these in MiB
    let FSxDataVolumeSize = Math.ceil(1.1 * FSxDataLunSizeInMib); // FSxDataLunSize + 10% of FSxDataLunSize
    let FSxLogVolumeSize = Math.ceil(0.25 * FSxDataVolumeSize); // 25% of FSxDataVolumeSize
    let FSxTempDbVolumeSize = Math.ceil(0.1 * FSxDataVolumeSize); // 10% of FSxDataVolumeSize
    let FSxQuorumVolumeSize = 0;
    if (sqlDeploymentMode !== STANDALONE) {
        FSxQuorumVolumeSize = 12000; // 12GB
    }
    const isPgsqlHADeployment =
        databaseType === DatabaseTypes.PG_SQL && (sqlDeploymentMode === HA || sqlDeploymentMode === FCI);
    if (databaseType === DatabaseTypes.PG_SQL) {
        FSxDataVolumeSize = FSxDataLunSizeInMib; // Absolute value of database size, as there won't be any LUN incase of NFS mounts
        FSxLogVolumeSize = Math.ceil(0.75 * FSxDataVolumeSize); // 75% of FSxDataVolumeSize
        FSxTempDbVolumeSize = 0; // No TempDB volume for PostgreSQL
        FSxQuorumVolumeSize = 0; // No Quorum volume for PostgreSQL
    }

    const totalVolumesSize =
        (isPgsqlHADeployment ? 2 : 1) * FSxDataVolumeSize +
        (isPgsqlHADeployment ? 2 : 1) * FSxLogVolumeSize +
        FSxTempDbVolumeSize +
        FSxQuorumVolumeSize;
    // Total FSx Storage Capacity with 35% headroom
    let FSxStorageCapacity = Math.ceil(totalVolumesSize / 0.65);
    const FSxBufferVolumeSize = FSxStorageCapacity - totalVolumesSize;
    // StorageCapacity in GiB
    FSxStorageCapacity = Math.ceil(FSxStorageCapacity / 1024);

    // 20 percent of FSxStorageCapacity
    // let FSxBufferVolumeSize = 0;
    // FSxBufferVolumeSize in GiB initially later converted to MiB
    // If the total fsx storage capacity goes beyond 192TiB Means, we will keep the buffer as 0
    // Otherwise we will calculate the 20 percent of FSxStorageCapacity as the buffer, Even then if that buffer plus fsx storage capacity goes beyond total limit of 192TiB, then we keep the difference
    // between FSxStorageCapacity and Max FSX Storage limit as buffer
    // if (FSxStorageCapacity < MAX_FSX_STORAGE_IN_GIB) {
    //     FSxBufferVolumeSize = Math.ceil(0.2 * FSxStorageCapacity);
    //     if (FSxStorageCapacity + FSxBufferVolumeSize >= MAX_FSX_STORAGE_IN_GIB) {
    //         FSxBufferVolumeSize = Math.ceil((MAX_FSX_STORAGE_IN_GIB - FSxStorageCapacity) * 1024);
    //         FSxStorageCapacity += FSxBufferVolumeSize / 1024;
    //     } else {
    //         FSxBufferVolumeSize = Math.ceil(FSxBufferVolumeSize * 1024);
    //         FSxStorageCapacity += FSxBufferVolumeSize / 1024;
    //     }
    // }

    FSxStorageCapacity = Math.max(FSxStorageCapacity, FSX_SSD_MIN_SIZE);
    FSxStorageCapacity = Math.min(FSxStorageCapacity, MAX_FSX_STORAGE_IN_GIB);

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

function getEc2Arn(awsAccountId: string, region: string, instanceId: string) {
    return `arn:aws:ec2:${region}:${awsAccountId}:instance/${instanceId}`;
}

function getQueueUrl(accountId: string, queueName: string) {
    logger.debug({ accountId, queueName });
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
    if (IS_DEMO_FLOW) {
        await new Promise(resolve => {
            setTimeout(resolve, 100);
        });
        return;
    }
    await new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function generateHash(value: string) {
    // changing it to shake256 to keep the resource_id smaller in size, as we don't have a unique constraint on resource_id
    const hash = crypto.createHash('shake256', { outputLength: 8 });
    hash.update(value);
    return hash.digest('hex');
}

function sizeInGigaBytes(size: number, currentUnit: string = 'MB') {
    logger.debug('Converting size to GiB', { size });

    if (Number.isNaN(size)) {
        return 0;
    }

    switch (currentUnit.toLocaleUpperCase()) {
        case 'B':
        case 'BYTE':
        case 'BYTES':
            return size / 1024 / 1024 / 1024;
        case 'KB':
            return size / 1000 / 1000;
        case 'KIB':
            return size / 1024 / 1024;
        case 'MB':
            return size / 1000;
        case 'MIB':
            return size / 1024;
        case 'TB':
            return size * 1000;
        case 'TIB':
            return size * 1024;
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
    logger.debug('checking account id', accountId);
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        const userId = getSubjectFromBearerToken();
        return userId && !accountId.includes('_') ? `${accountId}_${userId}` : accountId;
    }
    return accountId;
}

async function getInstancesWithResourceForDemo(databaseInstances: DatabaseInstances[], resources: Resource[]) {
    const updatedInstances: DatabaseInstancesIncludingResource[] = databaseInstances
        .map(instance => {
            const foundResource = resources.find(res => res.resource_id === instance.resource_id);
            return foundResource ? { ...instance, resource: foundResource } : undefined;
        })
        .filter((instance): instance is DatabaseInstancesIncludingResource => instance !== undefined);
    return updatedInstances;
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
function getDescriptionForMatchingName(jobName: string, stackSqlDeploymentType: string, dbEngineType: string = 'SQL') {
    logger.info('Return job decription for job name:', { jobName, stackSqlDeploymentType, dbEngineType });
    // ValidationStack1 is the only common stack between FCI and Standalone Deployment that has different description.
    // Diffrentiating between the deployment type to provide appropriate description.
    const subJobDescriptions = getSubJobDescriptions(dbEngineType, stackSqlDeploymentType);
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

    if (input) {
        for (const metric of input) {
            const [key, value] = metric?.split(':') || [];
            metrics[key] = value;
        }
    }
    return metrics;
}

/*
 * AWS considers the value of tag 'Name' as the resource name.
 * If tag 'Name' is present, return its corresponding Value.
 * Otherwise, returns undefined.
 */
function getResourceNameFromTags(tags?: Tag[]) {
    logger.debug('Find resource name from the tags', { tags });

    const { Value: name } = tags?.find(tag => tag?.Key === 'Name') || {};
    return name;
}

function getArtifactsRegionBucketName(region: string) {
    return `${ARTIFACT_BUCKET_NAME.replace('REGION', region)}`;
}

function sqlResponseParsing(response: string) {
    try {
        // Some responses have \\r\\n in them, so repeating this step twice to remove all of them
        const cleanResponse = response
            .replaceAll('\r\n', '')
            ?.replaceAll('\\r\\n', '')
            ?.replaceAll('\n', '')
            ?.replaceAll('\\n', '');
        const jsonResponse = JSON.parse(cleanResponse);
        return jsonResponse;
    } catch (error) {
        logger.error('Error parsing query response:', response);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error parsing query response: ${response}`);
    }
}

/**
 * Parses JSON file content and throws a standardized error if parsing fails
 */
function parseAssessmentFileContent(fileContent: string) {
    try {
        return JSON.parse(fileContent);
    } catch {
        throw createError(HttpErrorCodes.BAD_REQUEST, 'Invalid JSON file format');
    }
}

function parsePgSqlInstanceInfo(instanceInfo: string) {
    try {
        let dbInstanceId;
        let dbClusterState;

        const parsedInstanceInfo = JSON.parse(instanceInfo);
        const result: { [key: string]: string } = {};

        parsedInstanceInfo?.forEach((item: string) => {
            const [key, value] = item.split(/:/);
            if (key && value) {
                result[key.trim()] = value.trim();
            }
        });
        if (result['Database system identifier']) {
            dbInstanceId = result['Database system identifier'];
        }

        if (result['Database cluster state']) {
            dbClusterState = result['Database cluster state'];
        }

        return { dbInstanceId, dbClusterState };
    } catch (error: any) {
        logger.error('Error parsing instance information:', error?.message);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, `Error parsing instance information: ${instanceInfo}`);
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
    return numeral(`${size}${unit}`).value();
}

function getMonthlyPriceFromHourlyPrice(hourlyPrice?: number) {
    if (hourlyPrice !== undefined) {
        return hourlyPrice * HOURS_IN_MONTH;
    }
}

// This is for generating instance name that can be executed in the local machine.
// For the default instance name 'MSSQLSERVER' - "$env:COMPUTERNAME"
// For the custom instance name - "$env:COMPUTERNAME\\$instanceName"
function getDatabaseInstanceName(instanceName: string, isDefault: boolean = true) {
    logger.info('Generate database instance name', { instanceName, isDefault });

    if (IS_DEMO_FLOW || isDefault) {
        return DEFAULT_MSSQL_INSTANCE_NAME;
    }

    return `${DEFAULT_MSSQL_INSTANCE_NAME}\\${instanceName.replace(/^.+\$/, '')}`;
}

function extractSqlInstanceName(serverName: string): string {
    logger.info('Extract SQL Server instance name', { serverName });

    const defaultInstancePattern = /^\$env:COMPUTERNAME$/i; // Case-insensitive match for $env:COMPUTERNAME
    const namedInstancePattern = /^\$env:COMPUTERNAME\\(.+)$/i; // Case-insensitive match for $env:COMPUTERNAME\instanceName

    if (IS_DEMO_FLOW || defaultInstancePattern.test(serverName)) {
        return DEFAULT_INSTANCE_NAME; // Default instance
    }

    const match = serverName.match(namedInstancePattern);
    if (match && match[1]) {
        return match[1]; // Named instance
    }

    throw createError(HttpErrorCodes.BAD_REQUEST, `Invalid server name format: ${serverName}`);
}

function getOriginalDatabaseInstanceName(instanceName: string | undefined): string {
    return instanceName?.split('\\')?.[1] || DEFAULT_INSTANCE_NAME;
}

/**
 * Returns formatted instance name with hostname for MSSQL
 */
function getServerNameWithHostname(sqlServerName?: string, instanceName?: string, databaseName?: string) {
    if (IS_DEMO_FLOW) {
        // In ssm-scope, the instance name is appended with the hostname. (like below)
        // instanceName: "MSSQL$SQL-Managed-Host-ProdPROD-MarketingCampaigns"
        // check this
        if (sqlServerName && instanceName && instanceName !== DEFAULT_INSTANCE_NAME) {
            instanceName = instanceName.replace(sqlServerName, '');
        }
    }

    if (instanceName && sqlServerName && databaseName) {
        return `${sqlServerName}\\${instanceName}\\${databaseName}`;
    }
    if (instanceName && sqlServerName) {
        return `${sqlServerName}\\${instanceName}`;
    }
    if (sqlServerName) {
        return `${sqlServerName}`;
    }

    return `${DEFAULT_INSTANCE_NAME}`;
}

function getEc2Hostname(dbEngine: DatabaseTypes, ec2InstanceTags?: Tag[]) {
    if (IS_DEMO_FLOW) {
        switch (dbEngine) {
            case DatabaseTypes.PG_SQL:
                return `pgsqlnode-${randomize('0', 4)}`;
            case DatabaseTypes.ORACLE:
                return `oracle-${randomize('0', 5)}`;
            case DatabaseTypes.MS_SQL_SERVER:
            default:
                return `sqlnode-${randomize('0', 5)}`;
        }
    }
    return getResourceNameFromTags(ec2InstanceTags);
}

async function decompressSSMResponse(response: string) {
    logger.debug('Decompressing SSM response', { response });

    response = response.replaceAll('\r\n', '');
    if (IS_DEMO_FLOW || isEmpty(response) || !isBase64(response)) {
        return response;
    }

    try {
        const buffer = Buffer.from(response, 'base64');

        const inflateRawPromise = promisify(inflateRaw);
        const result = await inflateRawPromise(buffer);
        return result.toString();
    } catch (err) {
        if (
            err instanceof Error &&
            ['invalid stored block lengths', 'invalid block type'].some(msg =>
                err?.message?.toLowerCase().includes(msg)
            )
        ) {
            logger.error('Trying to decompress response that is not base64 encoded', response);
            return response;
        }
        logger.error('Error decompressing SSM response', err);
        throw createError('Error decompressing SSM response');
    }
}

const retryWithDelay = async (fn: any, retries = 3, interval = 5000, finalErr = 'Retry failed') => {
    try {
        const resp = await fn();
        return resp;
    } catch (err) {
        const errorMessage = `Retry failed with error: ${err}`;
        logger.error(errorMessage);
        if (retries <= 0) {
            return Promise.reject(errorMessage);
        }

        await sleep(interval);

        return retryWithDelay(fn, retries - 1, interval, finalErr);
    }
};

function getRedisDetails() {
    logger.debug('in getRedisDetails');
    const url = SECRETS.REDIS_PASSWORD ? `${REDIS_SCHEMA}://${SECRETS.REDIS_PASSWORD}@${REDIS_URL}` : REDIS_URL;
    return { url };
}

let redisConnection: IORedis | null = null;

function getRedisConnection() {
    if (redisConnection) {
        logger.debug('Reusing existing Redis connection');
        return redisConnection;
    }

    const redisDetails = getRedisDetails();

    redisConnection = new IORedis(redisDetails.url, {
        maxRetriesPerRequest: null,
        retryStrategy: times => {
            if (times > 2) {
                logger.error('Max retries reached for Redis connection');
                return null;
            } // return null to stop retrying
            return Math.min(times * 100, 2000); // Exponential backoff with a max delay of 2 seconds
        }
    });

    redisConnection.on('error', error => {
        logger.error('Redis connection error:', error);
    });

    redisConnection.on('ready', () => {
        logger.info('Connected to Redis server and status is ready');
    });

    return redisConnection;
}

function isRedisConnected(redisClient: IORedis) {
    return redisClient?.status === 'ready';
}

function getTimeDifferenceInMinutes(startTime: number, endTime: number = Date.now()) {
    // Calculate the time difference in minutes
    logger.debug('Calculate time difference in minutes', { startTime, endTime });
    const timeDifferenceInMilliseconds = Math.abs(endTime - startTime);
    return Math.floor(timeDifferenceInMilliseconds / (1000 * 60));
}

function filterActions(actions: string | string[]) {
    if (Array.isArray(actions)) {
        return actions.filter(action => !PERMISSIONS_TO_IGNORE_FOR_DEPLOYMENT.includes(action));
    }
    return PERMISSIONS_TO_IGNORE_FOR_DEPLOYMENT.includes(actions) ? [] : [actions];
}

function getRegionDetails(region: string): RegionDetailsType {
    return {
        name: AWS_REGIONS.has(region) ? AWS_REGIONS.get(region) : '',
        code: region
    };
}

function calculateFsxStorageCapacityForHeadroomOptimization(
    totalVolumeSizeInBytes: number,
    ssdStorageCapacityInBytes: number,
    databaseType: RESOURCESTYPE.ORACLE | RESOURCESTYPE.MSSQL = RESOURCESTYPE.MSSQL
): number {
    const percentage = (100 - MIN_OPTIMIZED_HEADROOM_PERCENTAGE[databaseType] - 1) / 100;
    let newFsxStorageCapacity = totalVolumeSizeInBytes / percentage;
    const increase = ((newFsxStorageCapacity - ssdStorageCapacityInBytes) / ssdStorageCapacityInBytes) * 100;
    // increase newFsxStorageCapacity so that increment is at least 10%
    newFsxStorageCapacity = increase > 10 ? newFsxStorageCapacity : ssdStorageCapacityInBytes * 1.1;

    const newFsxStorageCapacityGiB = Math.ceil(sizeInGigaBytes(newFsxStorageCapacity, 'B'));
    return newFsxStorageCapacityGiB;
}

function extractKbNumber(displayName: string): string | null {
    const match = displayName.match(/(KB\d+)/);
    return match ? match[1] : null;
}

function extractVersionDetails(sqlVersion: string) {
    const normalizedSqlVersion = sqlVersion.trim();

    const match = normalizedSqlVersion.match(/Microsoft SQL Server (\d{4})/);

    const dateMatch = normalizedSqlVersion.match(/(\w{3}\s+\d{1,2}\s+\d{4})/);
    const releaseDate = dateMatch ? dateMatch[1] : 'Unknown';

    return {
        version: match ? match[1] : 'Unknown',
        releaseDate
    };
}

function getSubJobDescriptions(dbEngineType: string, stackSqlDeploymentType?: string) {
    logger.info('Get sub job descriptions', { dbEngineType, stackSqlDeploymentType });

    const subJobDescriptions: SubJobDescriptions = {
        SQLStandaloneStack: `Deploying an ${dbEngineType} Server standalone instance with recommended best practices`,
        PGSQLServerStack: `Deploying an ${dbEngineType} Server ${
            stackSqlDeploymentType === 'Standalone' ? 'standalone' : 'ha'
        } instance with recommended best practices`,
        SQLServerStack: `Deploying an ${dbEngineType} Server FCI with recommended best practices`,
        NewFSxStack: `Deploying new FSx for ONTAP file system for ${dbEngineType} Server workload`,
        ExistingFSxStack: `Deploying a storage virtual machine for the ${dbEngineType} Server workload on the FSx for ONTAP file system`,
        'ValidationStack1-standalone': 'Subnet Validation for deployment',
        'ValidationStack1-fci': `Primary subnet validation for ${dbEngineType} Server FCI deployment`,
        ValidationStack2: `Standby subnet validation for ${dbEngineType} Server FCI deployment`,
        'SqlNode(AWS::EC2::Instance)': `Configuring ${dbEngineType} Server standalone on an EC2 instance`,
        'NetworkInterface(AWS::EC2::NetworkInterface)': 'Creating network interfaces for the EC2 instance',
        'WorkloadSecurityGroup(AWS::EC2::SecurityGroup)': `Creating a security group for ${dbEngineType} Server workloads`,
        'LaunchWizardSqlFSxProfile(AWS::IAM::InstanceProfile)': `Attaching an instance profile to EC2 instances for ${dbEngineType} Server nodes`,
        'DisableIMDSv1(AWS::EC2::LaunchTemplate)': 'Disabling instance metadata service v1 to use more secure v2',
        'FSxTempDbVolumeConfiguration(AWS::FSx::Volume)': 'Creating a volume to host tempdb',
        'FSxClusterQuorumVolumeConfiguration(AWS::FSx::Volume)':
            'Creating a volume to host witness disk for Windows Cluster',
        'FSxDataVolumeConfiguration(AWS::FSx::Volume)': 'Creating a volume to host data files',
        'FSxLogVolumeConfiguration(AWS::FSx::Volume)': 'Creating a volume to host log files',
        'FSxSvmConfiguration(AWS::FSx::StorageVirtualMachine)':
            'Creating a dedicated storage virtual machine (SVM) for the database workload',
        'FSxFileSystemConfiguration(AWS::FSx::FileSystem)': 'Creating a new FSx for ONTAP file system',
        'ONTAPSecurityGroup(AWS::EC2::SecurityGroup)': 'Creating a security group for FSx for ONTAP',
        'ValidationNode1(AWS::EC2::Instance)':
            'Validating outbound connection to deployment resources in Amazon S3, Active Directory, and FSx for ONTAP',
        'ValidationNode1WaitCondition(AWS::CloudFormation::WaitCondition)': 'Waiting for validation completion',
        'DomainMemberSG(AWS::EC2::SecurityGroup)': 'Creating a security group for the validation instance',
        'ValidationInstanceProfile(AWS::IAM::InstanceProfile)':
            'Attaching an instance profile to the validation instance',
        'ValidationNode1WaitHandler(AWS::CloudFormation::WaitConditionHandle)':
            'Signaling wait condition to resume next steps',
        'SqlFSxInstanceMAD1(AWS::EC2::Instance)': `Configuring Windows Cluster and ${dbEngineType} FCI instance on primary node`,
        'SqlFSxInstanceMAD2(AWS::EC2::Instance)': `Configuring Windows Cluster and ${dbEngineType} FCI instance on standby node`,
        'NetworkInterface2(AWS::EC2::NetworkInterface)':
            'Creating network interfaces for the EC2 instance in standby subnet',
        'NetworkInterface1(AWS::EC2::NetworkInterface)':
            'Creating network interfaces for the EC2 instance in primary subnet',
        'NetworkInterface3(AWS::EC2::NetworkInterface)':
            'Creating network interface for PgPool instance in primary subnet',
        'ValidationNode2(AWS::EC2::Instance)':
            'Validating outbound connection to deployment resources in Amazon S3, Active Directory, and FSx for ONTAP',
        'ValidationNode2WaitCondition(AWS::CloudFormation::WaitCondition)': 'Waiting for validation completion',
        'ValidationNode2WaitHandler(AWS::CloudFormation::WaitConditionHandle)':
            'Signaling wait condition to resume next steps',
        VpcEndpointStack: 'Creating VPC endpoints for S3 CloudFormation, SQS, SSM, CloudWatch services',
        'HttpsSecurityGroup(AWS::EC2::SecurityGroup)': 'Creating security group to allow HTTPs access',
        'S3Endpoint(AWS::EC2::VPCEndpoint)': 'Creating S3 gateway endpoint',
        'CloudformationEndpoint(AWS::EC2::VPCEndpoint)': 'Creating CloudFormation endpoint',
        'Ec2MessagesEndpoint(AWS::EC2::VPCEndpoint)': 'Creating EC2Messages endpoint',
        'SqsEndpoint(AWS::EC2::VPCEndpoint)': 'Creating SQS endpoint',
        'SsmEndpoint(AWS::EC2::VPCEndpoint)': 'Creating SSM endpoint',
        'SsmMessagesEndpoint(AWS::EC2::VPCEndpoint)': 'Creating SSMMessages endpoint',
        'FsxEndpoint(AWS::EC2::VPCEndpoint)': 'Creating FSxN endpoint',
        'CloudwatchLogsEndpoint(AWS::EC2::VPCEndpoint)': 'Creating CloudWatch logs endpoint',
        'Ec2Endpoint(AWS::EC2::VPCEndpoint)': 'Creating EC2 endpoint',
        'FSxReplicaDataVolumeConfiguration(AWS::FSx::Volume)':
            'Creating a volume to host data files for replica instance',
        'FSxReplicaSvmConfiguration(AWS::FSx::StorageVirtualMachine)':
            'Creating a dedicated storage virtual machine for replica instance',
        'FSxReplicaLogVolumeConfiguration(AWS::FSx::Volume)':
            'Creating a volume to host log files for replica instance',
        'SqlNode1(AWS::EC2::Instance)': `Configuring ${dbEngineType} Server ${
            stackSqlDeploymentType === 'Standalone' ? 'standalone on an' : 'ha on primary'
        } EC2 instance`,
        'SqlNode2(AWS::EC2::Instance)': `Configuring ${dbEngineType} Server ha on replica EC2 instance`,
        'PgPoolNode(AWS::EC2::Instance)': 'Configuring PgPool instance'
    };

    if (dbEngineType === RESOURCESTYPE.PGSQL) {
        subJobDescriptions['ValidationNode1(AWS::EC2::Instance)'] =
            'Validating outbound connection to deployment resources in Amazon S3 for primary validation node';
        subJobDescriptions['ValidationNode2(AWS::EC2::Instance)'] =
            'Validating outbound connection to deployment resources in Amazon S3 for replica validation node';
        subJobDescriptions.ValidationStack = `Subnet Validation for ${dbEngineType} deployment`;
    }

    return subJobDescriptions;
}

function isMssql(resourceType: string) {
    return resourceType === DatabaseTypes.MS_SQL_SERVER;
}

function isPgsql(resourceType: string) {
    return resourceType === DatabaseTypes.PG_SQL;
}

const isRateLimited = (cacheType: string, cacheKey: string, LIMIT: number, ttl?: StringValue): boolean => {
    const cacheNum = readFromCacheByKey(cacheType, cacheKey);
    if (!cacheNum) {
        writeToCache(cacheType, cacheKey, 1, ttl);
        return false;
    }
    if ((cacheNum as number) >= LIMIT) {
        return true;
    }
    writeToCache(cacheType, cacheKey, (cacheNum as number) + 1);
    return false;
};

const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

function parseMultipleCommandResponse(response: string) {
    // Multiple SSM command response is of the form {<json1String>}{<json2String>}...{<jsonnString>}, so we need to split the response into individual json objects and return them as an array
    response = response.replaceAll('\r\n', '');
    response = response.replaceAll('\\r\\n', '');
    response = response.replaceAll('\n', '');
    response = response.replaceAll('\\n', '');

    const results: any[] = [];
    let depth = 0;
    let start = 0;
    let inString = false;
    let escapeNext = false;
    const bracketStack: string[] = [];

    for (let i = 0; i < response.length; i++) {
        const char = response[i];

        // continue blocks beloew handle the escaped characters and strings that are intentionally escaped
        if (escapeNext) {
            escapeNext = false;
            // eslint-disable-next-line no-continue
            continue;
        }

        if (char === '\\' && !escapeNext) {
            escapeNext = true;
            // eslint-disable-next-line no-continue
            continue;
        }

        if (char === '"' && !escapeNext) {
            inString = !inString;
            // eslint-disable-next-line no-continue
            continue;
        }

        // Only process brackets when not inside a string
        if (!inString) {
            if (char === '{' || char === '[') {
                if (depth === 0) {
                    start = i;
                }
                depth += 1;
                bracketStack.push(char);
            } else if (char === '}' || char === ']') {
                // Check for matching brackets
                if (bracketStack.length > 0) {
                    const lastOpen = bracketStack[bracketStack.length - 1];
                    const isMatchingPair = (lastOpen === '{' && char === '}') || (lastOpen === '[' && char === ']');

                    if (isMatchingPair) {
                        bracketStack.pop();
                        depth -= 1;

                        if (depth === 0 && start >= 0) {
                            const jsonString = response.substring(start, i + 1);
                            try {
                                const parsed = JSON.parse(jsonString);
                                results.push(parsed);
                            } catch (error) {
                                logger.error('Failed to parse JSON segment:', { jsonString, error });
                            }
                            start = -1;
                        }
                    }
                }
            }
        }
    }

    return results;
}

function divideArrayIntoChunks(array: any[], chunkSize: number) {
    const chunksArray = array.reduce((resultArray: any[][], item, index) => {
        const chunkIndex = Math.floor(index / chunkSize);

        if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = []; // start a new chunk
        }

        resultArray[chunkIndex].push(item);

        return resultArray;
    }, []);
    return chunksArray;
}

function isValidProp(propName: string) {
    return propName && propName !== 'undefined' && propName !== 'null';
}

// When the array has one element, powershell returns only the object instead of the array. This function will convert it to an array
function formatSsmArrayResponse<T>(response: T | T[]): T[] {
    if (Array.isArray(response)) {
        return response;
    }
    return response ? [response] : [];
}

/**
 * Calculates the number of days between two dates.
 * @param startDate - The start date.
 * @param endDate - The end date. Defaults to the current date if not provided.
 * @returns The number of days between the two dates.
 */
function calculateDaysSince(startDate: string | Date, endDate: string | Date = new Date()): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDifference = end.getTime() - start.getTime();
    return Math.floor(timeDifference / (1000 * 60 * 60 * 24));
}

function calculateRecommendedMaxDOP(vcpuCount: number) {
    let recommendedMaxDOP = '16';
    if (vcpuCount <= 8) {
        recommendedMaxDOP = '4';
    } else if (vcpuCount <= 16) {
        recommendedMaxDOP = '8';
    }
    return recommendedMaxDOP;
}

function determineVolumeType(cloneVolumeName: string): 'log' | 'data' | 'unknown' {
    if (cloneVolumeName.includes('sqllog')) {
        return 'log';
    }
    if (cloneVolumeName.includes('sqldata')) {
        return 'data';
    }
    return 'unknown'; // Default case if neither 'sqllog' nor 'sqldata' is found
}

function generateSqlResourceId(node1InstanceId: string, node2InstanceId?: string): string {
    const sortedInstanceIds = [node1InstanceId, node2InstanceId].sort();
    return node2InstanceId ? generateHash(sortedInstanceIds.join('')) : generateHash(node1InstanceId);
}

function escapeBackslash(str: string) {
    return str && !str.includes('\\') ? str.replace(/\\/g, '\\\\') : str;
}

function getUnitForMetric(metricName: string): StandardUnit | undefined {
    switch (metricName) {
        case 'readThroughput':
        case 'writeThroughput':
            return StandardUnit.Kilobytes_Second;
        case 'cpuUsed':
            return StandardUnit.Percent;
        case 'readLatency':
        case 'writeLatency':
        case 'serverIOLatency':
            return StandardUnit.Milliseconds;
        default:
            return undefined;
    }
}

function assessMssqlServerPerformance(serverIOlatencyTrend: Array<{ value: number }>) {
    const serverIoLatency =
        Array.isArray(serverIOlatencyTrend) && serverIOlatencyTrend.length > 0
            ? serverIOlatencyTrend[serverIOlatencyTrend.length - 1].value || 0
            : 0;
    let assessment = 'N/A';
    if (serverIoLatency <= 1) {
        assessment = 'Excellent ( <=1 ms )';
    } else if (serverIoLatency < 5) {
        assessment = 'Very good ( <5 ms )';
    } else if (serverIoLatency < 10) {
        assessment = 'Good ( <10 ms )';
    } else if (serverIoLatency < 20) {
        assessment = 'Poor ( <20 ms )';
    } else if (serverIoLatency < 100) {
        assessment = 'Bad ( <100 ms )';
    } else if (serverIoLatency < 500) {
        assessment = 'Very bad ( <500 ms )';
    } else if (serverIoLatency >= 500) {
        assessment = 'Awful ( >=500 ms )';
    }

    return { serverIoLatency, assessment };
}

function getSqlInstanceMetricDataQueries(databaseHostId: string, instanceName: string) {
    logger.debug('Generating SQL instance metric data queries', { databaseHostId, instanceName });
    const metricDataQueries = CLOUD_WATCH_METRICS_PERFORMANCE_METRIC_NAMES.map(metricName => ({
        Id: metricName,
        MetricStat: {
            Metric: {
                Namespace: CLOUD_WATCH_METRICS_PERFORMANCE_NAMESPACE,
                MetricName: metricName,
                Dimensions: [
                    {
                        Name: 'databaseHostId',
                        Value: databaseHostId
                    },
                    {
                        Name: 'sqlInstanceName',
                        Value: instanceName
                    }
                ]
            },
            Period: 3600 * 24, // 24 hours
            Stat: 'Maximum',
            Unit: getUnitForMetric(metricName)
        },
        ReturnData: true
    }));
    logger.debug('Metric data queries for SQL instance:', metricDataQueries);

    const params = {
        StartTime: new Date(Date.now() - 7 * 24 * 3600 * 1000), // 7 days
        EndTime: new Date(),
        MetricDataQueries: metricDataQueries
    };
    return params;
}

function isNonEmptyObject(obj: any) {
    return isObject(obj) && !isEmpty(obj);
}

function isCidrContained(outerCidr: string, innerCidr: string): boolean {
    logger.debug('Checking if CIDR is contained', { outerCidr, innerCidr });
    const outer = new CIDR(outerCidr);
    const inner = new CIDR(innerCidr);

    // Check prefix length
    const outerPrefix = parseInt(outerCidr.split('/')[1], 10);
    const innerPrefix = parseInt(innerCidr.split('/')[1], 10);
    if (innerPrefix < outerPrefix) {
        return false;
    }

    // Check if inner's network address is within outer's range
    return outer.contains(inner.address);
}

function sanitizeSnsSubject(subject: string): string {
    // Remove all ASCII control characters (0-31 and 127)
    // Intentionally removing control characters for SNS subject compliance
    // eslint-disable-next-line no-control-regex
    subject = subject.replace(/[\x00-\x1F\x7F]/g, '');
    // Truncate to 99 characters
    if (subject.length > 99) {
        subject = subject.slice(0, 99);
    }
    return subject;
}

function getNextToken<T extends { id: string }>(
    items: T[],
    totalResourcesCount: number,
    pageSize: number
): string | undefined {
    logger.debug('Calculating next token', { items, totalResourcesCount, pageSize });

    if (isEmpty(items) || !totalResourcesCount || !pageSize) {
        return undefined;
    }

    return totalResourcesCount > pageSize && items.length >= pageSize ? items[items.length - 1]?.id : undefined;
}

// Database query helper functions
function buildSelectFields(fields: string[]): Record<string, boolean> {
    return Object.fromEntries(fields.map(field => [field, true]));
}

function addIncludeSelect(key: string, fields: string[], extra?: Record<string, boolean>) {
    return {
        [key]: {
            select: extra ? { ...buildSelectFields(fields), ...extra } : buildSelectFields(fields)
        }
    };
}

/**
 * Converts milliseconds to human-readable duration
 * Shows: seconds, minutes:seconds, or hours:minutes:seconds
 */
function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        // Format: 2h 15m 30s
        const remainingMinutes = minutes % 60;
        const remainingSeconds = seconds % 60;

        let result = `${hours}h`;
        if (remainingMinutes > 0) {
            result += ` ${remainingMinutes}m`;
        }
        if (remainingSeconds > 0) {
            result += ` ${remainingSeconds}s`;
        }

        return result;
    }

    if (minutes > 0) {
        // Format: 15m 30s
        const remainingSeconds = seconds % 60;
        return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    // Format: 30s
    return `${seconds}s`;
}

function determineStorageType(instance: DatabaseInstance) {
    return (
        instance.storage_type ||
        (instance.fsxn_ids
            ? STORAGE_TYPE.FSXN
            : instance.ebsVolumeIds
            ? STORAGE_TYPE.EBS
            : instance.fsxwId
            ? STORAGE_TYPE.FSXW
            : NOT_AVAILABLE)
    );
}

function getFsxNameFromTags(tags?: Tag[]) {
    return tags?.reduce((a = '', tag) => (tag.Key === 'Name' ? tag.Value : a), '');
}

const IS_DEMO_FLOW = process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator';
const IS_PROD = process.env.NODE_ENV === 'production';

function isMultiAzDeployment(deploymentType: string) {
    return [SqlServerDeploymentModel.SQL_AOAG_SHORT, SqlServerDeploymentModel.SQL_FCI_SHORT, 'DG'].includes(
        deploymentType as SqlServerDeploymentModel
    );
}

type SummaryInner = string | number | boolean | null | undefined | '[Object]';
type SummaryObject = Record<string, SummaryInner>;
export type Summary = string | number | boolean | null | undefined | SummaryObject;

function summarizeInnerValue(val: any): SummaryInner {
    if (!val || ['string', 'number', 'boolean'].includes(typeof val)) {
        return val;
    }
    if (Array.isArray(val)) {
        return val.length ?? 0;
    }
    if (typeof val === 'object') {
        return '[Object]';
    }
    // fallback for other types (symbol, bigint, function) -> stringified
    return String(val) as SummaryInner;
}

function summarizeObjectFirstLevel(obj: Record<string, any>): SummaryObject {
    return Object.fromEntries(Object.entries(obj).map(([k, v]): [string, SummaryInner] => [k, summarizeInnerValue(v)]));
}

function summarizeFirstLevel(input: any): Summary {
    if (!input || ['string', 'number', 'boolean'].includes(typeof input)) {
        return input;
    }

    if (Array.isArray(input)) {
        return input.length ?? 0;
    }

    if (typeof input === 'object') {
        return Object.fromEntries(
            Object.entries(input).map(([key, val]) => {
                if (!val || ['string', 'number', 'boolean'].includes(typeof val)) {
                    return [key, val];
                }
                if (Array.isArray(val)) {
                    return [key, val.length ?? 0];
                }
                if (typeof val === 'object') {
                    return [key, summarizeObjectFirstLevel(val)];
                }
                return [key, String(val)];
            })
        ) as SummaryObject;
    }

    // fallback for other types
    return String(input) as Summary;
}

function camelCaseToHyphenated(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function hyphenatedToPascalCaseWithSpace(str: string): string {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

async function createInMemoryZip(options: {
    scriptContent: string;
    databaseType: string;
    filename?: string;
    version?: string;
}): Promise<{ zipBuffer: Buffer; filename: string }> {
    const { scriptContent, databaseType, filename, version } = options;
    const baseFilename = filename ?? ASSESSMENT_SCRIPT_FILENAMES[databaseType];

    if (!baseFilename) {
        throw new Error(`No default filename found for database type: ${databaseType}`);
    }

    // Insert version into filename (e.g., NetApp_WF_MSSQL_Assessment_v1.0.0.ps1)
    const scriptFilename = version ? baseFilename.replace(/(\.[^.]+)$/, `_v${version}$1`) : baseFilename;

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.append(scriptContent, { name: scriptFilename });
    archive.finalize();

    const chunks: Buffer[] = [];
    for await (const chunk of archive) {
        chunks.push(chunk as Buffer);
    }

    return {
        zipBuffer: Buffer.concat(chunks),
        filename: scriptFilename.replace(/\.[^.]+$/, '.zip')
    };
}

/**
 * Map of database types to their default assessment script filenames
 */
const ASSESSMENT_SCRIPT_FILENAMES: Record<string, string> = {
    mssql: 'NetApp_WF_MSSQL_Assessment.ps1',
    oracle: 'NetApp_WF_Oracle_Assessment.sh',
    pgsql: 'NetApp_WF_PostgreSQL_Assessment.sh'
};

function compressSsmCommand(params: SendCommandCommandInput) {
    // Compress commands if they exceed size threshold
    if (IS_DEMO_FLOW) {
        logger.debug('Skipping SSM command compression in demo flow');
        return params;
    }
    const isBashScript = params.DocumentName === SSM_RUN_SHELL_SCRIPT_DOC;
    const isPowerShellScript = params.DocumentName === SSM_RUN_POWERSHELL_SCRIPT_DOC;

    if ((isBashScript || isPowerShellScript) && params.Parameters?.commands) {
        const commandsStr = JSON.stringify(params.Parameters.commands);
        const commandsSize = Buffer.byteLength(commandsStr, 'utf8');

        logger.info(`SSM command size: ${commandsSize} bytes`);

        if (commandsSize > SSM_COMMAND_COMPRESSION_THRESHOLD) {
            logger.info('Compressing large SSM command...');

            // Join commands array into single script
            const scriptContent = Array.isArray(params.Parameters.commands)
                ? params.Parameters.commands.join('\n')
                : params.Parameters.commands;

            // Compress the script with level=6, default level
            const compressed = gzipSync(scriptContent, { level: 6 });
            const compressedBase64 = compressed.toString('base64');

            logger.info(
                `Compressed size: ${compressedBase64.length} bytes (${Math.round(
                    (compressedBase64.length / commandsSize) * 100
                )}% of original)`
            );

            // Replace commands with appropriate decompression wrapper
            if (isBashScript) {
                params.Parameters.commands = [BASH_DECOMPRESS_TEMPLATE(compressedBase64)];
            } else {
                // Split base64 into chunks for PowerShell here-string readability (80 char lines)
                const chunks = compressedBase64.match(/.{1,80}/g) || [compressedBase64];
                const base64Data = chunks.join('\n');
                params.Parameters.commands = [POWERSHELL_DECOMPRESS_TEMPLATE(base64Data)];
            }

            const finalSize = Buffer.byteLength(JSON.stringify(params), 'utf8');
            logger.info(`Final SSM request size: ${finalSize} bytes`);

            if (finalSize > SSM_COMMAND_COMPRESSION_THRESHOLD) {
                throw new Error(
                    `Compressed payload still exceeds SSM limit: ${finalSize} bytes. Original: ${commandsSize} bytes`
                );
            }
        }
    }
    return params;
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
    getEc2Arn,
    generateHash,
    fsxStorageCapacityBreakdown,
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
    convertToBytes,
    getMonthlyPriceFromHourlyPrice,
    getDatabaseInstanceName,
    getOriginalDatabaseInstanceName,
    decompressSSMResponse,
    retryWithDelay,
    getRedisDetails,
    getTimeDifferenceInMinutes,
    filterActions,
    getRegionDetails,
    calculateFsxStorageCapacityForHeadroomOptimization,
    getSubJobDescriptions,
    parsePgSqlInstanceInfo,
    getServerNameWithHostname,
    extractKbNumber,
    extractVersionDetails,
    isMssql,
    isPgsql,
    isValidEmail,
    isRateLimited,
    parseMultipleCommandResponse,
    divideArrayIntoChunks,
    isValidProp,
    calculateDaysSince,
    calculateRecommendedMaxDOP,
    determineVolumeType,
    formatSsmArrayResponse,
    generateSqlResourceId,
    extractSqlInstanceName,
    escapeBackslash,
    getEc2Hostname,
    getInstancesWithResourceForDemo,
    getRedisConnection,
    isNonEmptyObject,
    getUnitForMetric,
    assessMssqlServerPerformance,
    getSqlInstanceMetricDataQueries,
    isCidrContained,
    sanitizeSnsSubject,
    getNextToken,
    formatDuration,
    addIncludeSelect,
    buildSelectFields,
    determineStorageType,
    getFsxNameFromTags,
    IS_DEMO_FLOW,
    IS_PROD,
    isMultiAzDeployment,
    isRedisConnected,
    summarizeFirstLevel,
    camelCaseToHyphenated,
    hyphenatedToPascalCaseWithSpace,
    createInMemoryZip,
    ASSESSMENT_SCRIPT_FILENAMES,
    compressSsmCommand,
    parseAssessmentFileContent
};
