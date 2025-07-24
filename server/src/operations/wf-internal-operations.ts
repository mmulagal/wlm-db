import { isEmpty, uniqBy } from 'lodash-es';
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

async function getDatabaseVolumes(accountId: string, pageSize = 500, nextToken?: string) {
    logger.info('Getting database volumes for account.', accountId, pageSize, nextToken);

    const { items, nextToken: newToken } = await paginateListInstanceConfigData({
        accountId,
        configDataType: AssessmentCategories.MAPPED_ONTAP_VOLUMES,
        ...(pageSize && { pageSize }),
        ...(nextToken && { nextToken }),
        select: { config_data: true, id: true },
        filters: { config_data: { not: {} } }
    });

    let volumes = items.flatMap(obj =>
        obj.config_data
            ? Object.values(obj.config_data).flatMap(cfg =>
                  (cfg as MappedOnTapVolumeResponse)?.volumeRecords
                      ?.filter(({ fsxVolumeId }) => Boolean(fsxVolumeId))
                      ?.map(({ uuid, name, fsxVolumeId }) => ({
                          id: fsxVolumeId ?? '',
                          name,
                          ontapUuid: uuid
                      }))
              )
            : []
    );

    volumes = uniqBy(volumes, 'id');
    return { count: volumes?.length ?? 0, volumes, nextToken: newToken };
}

export { getSystemStatus, getDatabaseVolumes };
