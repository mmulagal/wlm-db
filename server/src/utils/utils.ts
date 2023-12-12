/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import { attempt, trimEnd, trimStart } from 'lodash-es';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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
    FCI_NETWORK_EMPTY_VIOLATION_REASON,
    FCI_NETWORK_ROUTE_TABLE_VIOLATION_REASON
} from './consts';

import getLogger, { hideSecretsValues } from './logger';
import { CFNetworkConfigurationType } from '../routes/types/deployment.types';

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
    const isViolated = false;
    if (deploymentMode === STANDALONE) {
        return { isViolated: !networkConfiguration.privateSubnet1Id || !networkConfiguration.routeTable1Id };
    }
    if (
        !networkConfiguration.privateSubnet1Id ||
        !networkConfiguration.privateSubnet2Id ||
        !networkConfiguration.routeTable1Id ||
        !networkConfiguration.routeTable2Id
    ) {
        return {
            isViolated: true,
            violationReason: FCI_NETWORK_EMPTY_VIOLATION_REASON
        };
    }
    // In simulator route table 1 and route table 2 id will be always same, so we cant check that condition
    if (process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator') {
        return false;
    }
    if (networkConfiguration.routeTable1Id === networkConfiguration.routeTable2Id) {
        return {
            isViolated: true,
            violationReason: FCI_NETWORK_ROUTE_TABLE_VIOLATION_REASON
        };
    }
    return isViolated;
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

function getEc2Arn(awsAccountId: string, region: string, ec2Id: string) {
    return `arn:aws:ec2:${region}:${awsAccountId}:instance/${ec2Id}`;
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
    calculateFsxStorageCapacity,
    sizeInGigaBytes
};
