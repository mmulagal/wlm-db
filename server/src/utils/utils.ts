/**
 * This file contains the utility functions
 * These functions can be re-used at different places and act as helper functions
 */

import { SQL_AMI_NAMES } from './consts';
import getLogger from './logger';

const logger = getLogger();

function filterSqlAmis(osVersion?: string, dbVersion?: string, dbEdition?: string) {
    logger.debug({ osVersion, dbEdition, dbVersion });
    return SQL_AMI_NAMES.filter(name => (osVersion ? name.includes(`Windows_Server-${osVersion}`) : true))
        .filter(name => (dbVersion ? name.includes(`SQL_${dbVersion}`) : true))
        .filter(name => (dbEdition ? name.includes(dbEdition) : true));
}

function generateFsxParams(FSxDataLunSize: number) {
    const prefix = 'wlmdb';
    const suffix = Date.now();

    return {
        FSxFileSystemName: `${prefix}-fsx-${suffix}`,
        FSxDataVolumeName: `${prefix}-sqldata-${suffix}`,
        FSxDataVolumeSize: 1.1 * FSxDataLunSize, // FSxDataLunSize + 10% of FSxDataLunSize
        FSxLogVolumeName: `${prefix}-sqllog-${suffix}`,
        FSxLogVolumeSize: 0.25 * 1.1 * FSxDataLunSize, // 25% of FSxDataVolumeSize
        FSxTempDBVolumeName: `${prefix}-sqltemp-${suffix}`,
        FSxTempDBVolumeSize: 0.1 * 1.1 * FSxDataLunSize, // 10% of FSxDataVolumeSize
        FSxQuorumVolumeName: `${prefix}-quorum-${suffix}`,
        FSxSvmName: `${prefix}-svm-${suffix}`
    };
}

export { filterSqlAmis, generateFsxParams };
