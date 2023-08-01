/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */

import { SQL_AMI_NAMES, WLMDB } from './consts';
import getLogger from './logger';

const logger = getLogger();

function filterSqlAmis(osVersion?: string, dbVersion?: string, dbEdition?: string) {
    logger.debug({ osVersion, dbEdition, dbVersion });
    return SQL_AMI_NAMES.filter(name => (osVersion ? name.includes(`Windows_Server-${osVersion}`) : true))
        .filter(name => (dbVersion ? name.includes(`SQL_${dbVersion}`) : true))
        .filter(name => (dbEdition ? name.includes(dbEdition) : true));
}

function generateFsxParams(FSxDataLunSize: number) {
    const prefix = WLMDB;
    const suffix = Date.now();

    const FSxDataVolumeSize = 1.1 * FSxDataLunSize; // FSxDataLunSize + 10% of FSxDataLunSize

    return {
        StackName: `${prefix}-SQLFCIStack-${suffix}`,
        VpcName: `${prefix}-vpc-${suffix}`,
        WSFClusterName: `WLMWSFC-${generateRandomNumberInRange(10000, 99999)}`,
        FSxFileSystemName: `${prefix}-fsx-${suffix}`,
        FSxDataVolumeName: `${prefix}-sqldata-${suffix}`,
        FSxDataVolumeSize,
        FSxLogVolumeName: `${prefix}-sqllog-${suffix}`,
        FSxLogVolumeSize: 0.25 * FSxDataVolumeSize, // 25% of FSxDataVolumeSize
        FSxTempDBVolumeName: `${prefix}-sqltemp-${suffix}`,
        FSxTempDBVolumeSize: 0.1 * FSxDataVolumeSize, // 10% of FSxDataVolumeSize
        FSxQuorumVolumeName: `${prefix}-quorum-${suffix}`,
        FSxSvmName: `${prefix}-svm-${suffix}`,
        SQLigroupname: `${prefix}-sqligroup-${suffix}`,
        SQLSvmName: `${prefix}-sqlsvm-${suffix}`,
        NodeNetBIOSNames: [`${prefix}-node1-${suffix}`, `${prefix}-node2-${suffix}`]
    };
}

function generateRandomNumberInRange(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min + 1));
}

export { filterSqlAmis, generateFsxParams };
