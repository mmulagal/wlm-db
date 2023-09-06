/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */
import { trimEnd, trimStart } from 'lodash-es';
import jwt from 'jsonwebtoken';
import { getAsyncLocalStorageResource } from './async-local-storage';

import { SQL_AMI_NAMES, WLMDB, USER_TOKEN, DEFAULT_AWS_REGION, FSX_SSD_MIN_SIZE, FSX_SSD_MAX_SIZE } from './consts';

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

function generateDeploymentParams(FSxDataLunSize: number, isExistingFSx: boolean) {
    const prefix = WLMDB;
    const suffix = Date.now();
    const randomDigits = generateRandomNumberInRange(10000, 99999);

    const FSxDataLunSizeInMib = FSxDataLunSize * 1024;

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

    return {
        UniqueID: suffix,
        StackName: `${prefix.toUpperCase()}-SQLFCIStack-${suffix}`,
        // VpcName: `${prefix}-vpc-${suffix}`,
        SqlFSxWSFCName: `WLMWSFC-${randomDigits}`,
        FSxFileSystemName: isExistingFSx ? '' : `${prefix}-fsx-${suffix}`,
        FSxDataVolumeName: `${prefix}_sqldata_${suffix}`,
        FSxDataVolumeSize,
        FSxLogVolumeName: `${prefix}_sqllog_${suffix}`,
        FSxLogVolumeSize, // 25% of FSxDataVolumeSize
        FSxTempDbVolumeName: `${prefix}_sqltemp_${suffix}`,
        FSxTempDbVolumeSize, // 10% of FSxDataVolumeSize
        FSxQuorumVolumeName: `${prefix}_quorum_${suffix}`,
        FSxQuorumVolumeSize,
        FSxSvmName: `${prefix}_svm_${suffix}`,
        SQLigroupname: `${prefix}_sqligroup_${suffix}`,
        SQLSvmName: `${prefix}_sqlsvm_${suffix}`,
        NodeNetBIOSNames: [`sqlnode1-${randomDigits}`, `sqlnode2-${randomDigits}`],
        DomainAdminSecretName: `${prefix}-domain-${suffix}`,
        FSxAdministratorPasswordSecret: `${prefix}-fsx${suffix}`,
        SQLServiceAccountSecret: `${prefix}-sql-${suffix}`,
        FSxStorageCapacity,
        FSxDataLunSize: FSxDataLunSizeInMib
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

function isSameRoutetables(networkConfiguration: CFNetworkConfigurationType) {
    return (
        'routeTable1Id' in networkConfiguration &&
        'routeTable2Id' in networkConfiguration &&
        networkConfiguration.routeTable1Id === networkConfiguration.routeTable2Id
    );
}
function isValidJsonString(str: string | undefined) {
    try {
        if (str) {
            return { isValid: true, message: JSON.parse(str) };
        }
        return { isValid: false };
    } catch (err) {
        return { isValid: false };
    }
}

function getQueueArn(accountId: string, queueName: string) {
    return `arn:aws:sqs:${DEFAULT_AWS_REGION}:${accountId}:${queueName}`;
}

function getQueueUrl(accountId: string, queueName: string) {
    return `https://sqs.${DEFAULT_AWS_REGION}.amazonaws.com/${accountId}/${queueName}`;
}

function derivePropertiesFromARN(awsResourceArn: string) {
    const ARN_FORMAT = /arn:aws:(?<awsServiceName>.+):(?<region>.+):(?<awsAccountId>.+):(?<resourceName>.+)/;
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

export {
    filterSqlAmis,
    generateDeploymentParams,
    getSubjectFromBearerToken,
    hideSecretsValues,
    isSameRoutetables,
    isValidJsonString,
    getQueueArn,
    getQueueUrl,
    derivePropertiesFromARN,
    sleep
};
