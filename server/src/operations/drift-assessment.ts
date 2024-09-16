import getLogger from '../utils/logger';
import { sqlResponseParsing } from '../utils/utils';
import { getMappedOntapVolumes } from './aws/fsx-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { MappedOnTapVolumeResponse } from './database-hosts-operations';
import { STORAGE_CONFIGURATION_ASSESSMENT } from './workloads/mssql/drift-assessment-scripts';

const logger = getLogger();

interface Instance {
    name: string;
    type: string;
    sqlAuthEnabled: boolean;
    fsxFileSystem: string;
    activeNodeInstanceid: string;
    mappedVolumeNames?: string[];
    mappedVolumesUuids?: string[];
    mappedLunNames?: string[];
    mappedLunUuids?: string[];
}

async function assessStorageDrift(credentialsId: string, region: string, instanceRecord: Instance) {
    logger.info('assessStorageDrift', credentialsId, region, instanceRecord);

    const instanceVolumeMapping = ((await getMappedOntapVolumes(
        credentialsId,
        region,
        instanceRecord.fsxFileSystem,
        false,
        instanceRecord.activeNodeInstanceid,
        [instanceRecord.name],
        false
    )) as MappedOnTapVolumeResponse[]) || [{ volumeUuids: [], volumeDBMap: {}, lunNames: [] }];

    instanceRecord.mappedVolumesUuids =
        Object.values(instanceVolumeMapping)
            ?.map(i => i?.volumeUuids)
            .flat() || [];

    instanceRecord.mappedLunNames =
        Object.values(instanceVolumeMapping)
            ?.map(i => i.lunNames)
            .flat() || [];

    const command = STORAGE_CONFIGURATION_ASSESSMENT(
        instanceRecord.name,
        region,
        instanceRecord.sqlAuthEnabled,
        instanceRecord.fsxFileSystem,
        instanceRecord.mappedVolumesUuids,
        instanceRecord.mappedLunNames
    );

    const response = await callSsmExecution(credentialsId, region, [command], instanceRecord.activeNodeInstanceid);

    const parsedResponse = response ? sqlResponseParsing(response) : {};

    logger.info(parsedResponse);
}

export { assessStorageDrift };
