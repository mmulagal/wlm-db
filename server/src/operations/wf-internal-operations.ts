import { compact, isEmpty, uniqBy } from 'lodash-es';
import getLogger from '../utils/logger';
import { getCredentials } from './cloud-manager/credentials-operations';
import { creadteDemoDBData } from '../utils/demo-utils/demoDefaultUtils';
import { MSSQL } from '../utils/consts';
import {
    onPremAOAGAUploadObject,
    onPremFCIUploadObject,
    onpremStdUploadObject
} from '../utils/demo-utils/demoMockdata';
import { getOnPremDatabaseResources, uploadOnpremTcoData } from './onprem-tco-operations';
import { AssessmentCategories } from '../utils/continous-optimization-consts';
import { MappedOnTapVolumeResponse } from '../utils/common-types';
import { paginateListInstanceConfigData } from './database/instance-config-operations';

const logger = getLogger();

async function getSystemStatus(accountId: string) {
    logger.info('Getting system status for account.', accountId);
    const credentialsType = 'aws_assume_role';
    const credentialsList = await getCredentials(credentialsType);
    if (process.env.NODE_ENV !== 'demo' && process.env.NODE_ENV !== 'simulator') {
        if (isEmpty(credentialsList)) {
            return { isActive: false };
        }
        return { isActive: true };
    }
    creadteDemoDBData(accountId, credentialsList);
    const resource = await getOnPremDatabaseResources(accountId, MSSQL);
    if (resource.count === 0) {
        uploadOnpremTcoData(accountId, MSSQL, onPremFCIUploadObject.fileName, onPremFCIUploadObject.fileContent);
        uploadOnpremTcoData(accountId, MSSQL, onPremAOAGAUploadObject.fileName, onPremAOAGAUploadObject.fileContent);
        uploadOnpremTcoData(accountId, MSSQL, onpremStdUploadObject.fileName, onpremStdUploadObject.fileContent);
    }
    return { isActive: true };
}

async function getDatabaseVolumes(accountId: string, pageSize = 500, nextToken?: string, fileSystemId?: string) {
    logger.info('Getting database volumes for account.', accountId, pageSize, nextToken, fileSystemId);

    const fileSystemIds = fileSystemId ? fileSystemId.trim().split(',') : undefined;
    const { items, nextToken: newToken } = await paginateListInstanceConfigData({
        accountId,
        configDataType: AssessmentCategories.MAPPED_ONTAP_VOLUMES,
        ...(pageSize && { pageSize }),
        ...(nextToken && { nextToken }),
        select: { config_data: true, id: true, database_instances: { select: { fsxn_ids: true } } },
        filters: {
            config_data: { not: {} },
            ...(!isEmpty(fileSystemIds) && {
                database_instances: {
                    fsxn_ids: { in: fileSystemIds }
                }
            })
        }
    });

    let volumes = items.flatMap(obj => {
        const { fsxn_ids: fsxId = '' } = obj.database_instances || {};
        return obj.config_data
            ? Object.values(obj.config_data).flatMap(cfg =>
                  (cfg as MappedOnTapVolumeResponse)?.volumeRecords
                      ?.filter(({ fsxVolumeId }) => Boolean(fsxVolumeId))
                      ?.map(({ uuid, name, fsxVolumeId }) => ({
                          id: fsxVolumeId ?? '',
                          name,
                          fsxId,
                          ontapUuid: uuid
                      }))
              )
            : [];
    });

    volumes = compact(uniqBy(volumes, 'id'));
    return { volumeCount: volumes?.length ?? 0, volumes, nextToken: newToken };
}

export { getSystemStatus, getDatabaseVolumes };
