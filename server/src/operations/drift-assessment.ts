import { isEmpty } from 'lodash-es';
import { DriftAssessmentResponseType, ParameterDriftResponseType } from '../routes/types/database-hosts.types';
import getLogger from '../utils/logger';
import { sqlResponseParsing } from '../utils/utils';
import { getMappedOntapVolumes } from './aws/fsx-operations';
import { callSsmExecution } from './aws/ssm-operations';
import { getInstanceDetails, MappedOnTapVolumeResponse } from './database-hosts-operations';
import { STORAGE_CONFIGURATION_ASSESSMENT } from './workloads/mssql/drift-assessment-scripts';
import storageGoldenConfigData from './drift-assessment/golden-configs/storage';
import { RESOURCESTYPE } from '../utils/consts';
import { WorkloadInstance } from '../utils/common-types';

const logger = getLogger();

const volumeConfigData = storageGoldenConfigData.configuration.volume;
const lunConfigData = storageGoldenConfigData.configuration.lun;
const osConfigData = storageGoldenConfigData.configuration.os;

async function assessStorageDrift(credentialsId: string, region: string, instanceRecord: WorkloadInstance) {
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

    const volumeRecords =
        Object.values(instanceVolumeMapping)
            ?.map(i => i?.volumeRecords)
            .flat() || [];
    instanceRecord.mappedVolumesUuids = volumeRecords.map(volume => volume.uuid as string);

    instanceRecord.mappedLunNames =
        Object.values(instanceVolumeMapping)
            ?.map(i => i.lunNames)
            .flat() || [];

    const command = STORAGE_CONFIGURATION_ASSESSMENT(instanceRecord);

    const response = await callSsmExecution(credentialsId, region, [command], instanceRecord.activeNodeInstanceid);

    const parsedResponse = response ? sqlResponseParsing(response) : {};

    const driftAssessmentData: DriftAssessmentResponseType = { storage: { configuration: [] } };
    parsedResponse.volumes.forEach((volume: { [key: string]: string }) => {
        const volumeDriftData: ParameterDriftResponseType = { name: volume.name, type: 'volume', parameters: [] };
        Object.entries(volume).forEach(([key, value]) => {
            const goldenData = volumeConfigData.find(data => data.parameter === key);
            if (goldenData && !isEmpty(goldenData)) {
                const isOptimised = goldenData?.value === value;
                volumeDriftData.parameters.push({
                    name: key,
                    current: value?.toString() || '',
                    recommended: goldenData.value.toString(),
                    isOptimised,
                    severity: goldenData.severity,
                    recommendation: goldenData.recommendation
                });
            }
        });
        driftAssessmentData.storage.configuration.push(volumeDriftData);
    });

    parsedResponse.luns.forEach((lun: { [key: string]: string }) => {
        const lunDriftData: ParameterDriftResponseType = { name: lun.name, type: 'lun', parameters: [] };
        Object.entries(lun).forEach(([key, value]) => {
            const goldenData = lunConfigData.find(data => data.parameter === key);
            if (!isEmpty(goldenData)) {
                const isOptimised = goldenData.value === value;
                lunDriftData.parameters.push({
                    name: key,
                    current: value?.toString() || '',
                    recommended: goldenData.value.toString(),
                    isOptimised,
                    severity: goldenData.severity,
                    recommendation: goldenData.recommendation
                });
            }
        });
        driftAssessmentData.storage.configuration.push(lunDriftData);
    });

    const osData = parsedResponse.os;
    const osDriftData: ParameterDriftResponseType = { name: 'os', type: 'os', parameters: [] };
    Object.entries(osData).forEach(([key, value]) => {
        const goldenData = osConfigData.find(data => data.parameter === key);
        if (!isEmpty(goldenData)) {
            const isOptimised = goldenData.value === value;
            osDriftData.parameters.push({
                name: key,
                current: value?.toString() || '',
                recommended: goldenData.value.toString(),
                isOptimised,
                severity: goldenData.severity,
                recommendation: goldenData.recommendation
            });
        }
    });
    driftAssessmentData.storage.configuration.push(osDriftData);

    return driftAssessmentData;
}

async function driftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string
) {
    logger.info('Get drift assessment', accountId, credentialsId, region, databaseHostId, databaseInstanceId);

    const { activeNodeInstanceId, newDatabaseInstanceDetails } = await getInstanceDetails(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId
    );
    const {
        database_instance_name: savedInstanceName,
        fsxn_ids: fileSystemId,
        sqlAuthEnabled
    } = newDatabaseInstanceDetails;

    return assessStorageDrift(credentialsId, region, {
        name: savedInstanceName,
        type: RESOURCESTYPE.MSSQL,
        region,
        sqlAuthEnabled: sqlAuthEnabled || false,
        activeNodeInstanceid: activeNodeInstanceId,
        fsxFileSystem: fileSystemId
    });
}

export { driftAssessment };
