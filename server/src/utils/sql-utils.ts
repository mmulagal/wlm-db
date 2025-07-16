import { STORAGE_TYPE } from '@prisma/client';
import { describeSubnets } from '../lib/aws/ec2';
import { describeFSx } from '../lib/aws/fsx';
import { FileSystemTypes, NOT_AVAILABLE } from './consts';
import getLogger from './logger';
import { DatabaseInstance, MappedOnTapVolumeResponse } from './common-types';
import { listDatabaseInstanceConfigData } from '../lib/database/database-instance-config';
import { AssessmentCategories } from './continous-optimization-consts';

const logger = getLogger();

async function getDatabaseInstanceTopology(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseInstances: DatabaseInstance
) {
    logger.info(
        'Fetching database topology data',
        accountId,
        credentialsId,
        activeNodeInstanceId,
        databaseInstances.database_instance_name
    );

    const {
        fsxn_ids: fileSystemId,
        storage_type: storageType,
        database_instance_id: databaseInstanceId,
        database_deployment_type: databaseDeploymentType,
        database_type: databaseType,
        fsxwId,
        resource: { resource_id: resourceId } = {}
    } = databaseInstances;

    let topologyData = {
        serverType: databaseType,
        serverInstallationMode: databaseDeploymentType !== undefined ? databaseDeploymentType : '',
        fileSystemId: fileSystemId! || fsxwId,
        fileSystemType:
            storageType !== undefined
                ? storageType === STORAGE_TYPE.FSXN
                    ? FileSystemTypes.FSXONTAP
                    : storageType === STORAGE_TYPE.FSXW
                    ? FileSystemTypes.FSXWINDOWS
                    : storageType
                : NOT_AVAILABLE
    };
    if (activeNodeInstanceId) {
        let fileSystemStatus;
        let fileSystemName;
        let fileSystemDeploymentMode;
        let fileSystemStorageCapacity;
        let fileSystemThroughputCapacity;
        let subnetIds;
        let availabilityZones: Array<string> | undefined;
        let fileSystemTags;
        let fileSystemStorageType;
        try {
            if (fileSystemId || fsxwId) {
                const fsxInfo = await describeFSx(
                    credentialsId,
                    region,
                    {
                        FileSystemIds: [(fileSystemId || fsxwId) as string]
                    },
                    undefined,
                    { useCache: true }
                );
                const [fileSystem = {}] = fsxInfo?.FileSystems || []; // first item in the list
                ({
                    Tags: fileSystemTags,
                    WindowsConfiguration: { DeploymentType: fileSystemDeploymentMode = undefined } = {},
                    OntapConfiguration: {
                        DeploymentType: fileSystemDeploymentMode = undefined,
                        ThroughputCapacity: fileSystemThroughputCapacity = undefined
                    } = {},
                    Lifecycle: fileSystemStatus,
                    StorageCapacity: fileSystemStorageCapacity,
                    SubnetIds: subnetIds,
                    StorageType: fileSystemStorageType
                } = fileSystem);

                fileSystemName = fileSystemTags?.reduce((a = '', tag) => (tag.Key === 'Name' ? tag.Value : a), '');

                const { Subnets: subnets } = await describeSubnets(credentialsId, region, {
                    SubnetIds: subnetIds
                });
                availabilityZones = subnets?.map(subnetId => subnetId?.AvailabilityZone as string);
            }
        } catch (error) {
            logger.error(`Error while fetching details for fsx. Error: ${error}`, {
                accountId,
                credentialsId,
                resourceId,
                databaseInstanceId
            });
        }

        const [{ config_data: mappedStorageDetails }] =
            (await listDatabaseInstanceConfigData({
                accountId,
                credentialsId,
                region,
                resourceId,
                databaseInstanceId,
                configDataType: AssessmentCategories.MAPPED_ONTAP_VOLUMES
            })) || {};

        const extractRecords = (records: Array<{ uuid: string; name: string }> = []) =>
            records.map(({ uuid, name }) => ({ id: uuid, name }));

        const mappedDetails = Object.values(mappedStorageDetails as MappedOnTapVolumeResponse) || [];
        const volumes = mappedDetails.flatMap(i => extractRecords(i?.volumeRecords));
        const luns = mappedDetails.flatMap(i => extractRecords(i?.lunRecords));
        const combinedOntapVolumes = volumes.map(volume => ({
            ...volume,
            luns: luns.filter(lun => lun.name.includes(volume.name))
        }));

        topologyData = {
            ...topologyData,
            ...(fileSystemName && { fileSystemName }),
            ...(fileSystemDeploymentMode && { fileSystemDeploymentMode }),
            ...(fileSystemStatus && { fileSystemStatus }),
            ...(fileSystemStorageCapacity && { fileSystemStorageCapacity }),
            ...(fileSystemThroughputCapacity && { fileSystemThroughputCapacity }),
            ...(availabilityZones && { availabilityZone: availabilityZones }),
            ...(fileSystemStorageType && { fileSystemStorageType }),
            ...(combinedOntapVolumes && {
                storageSummary: {
                    volumes: combinedOntapVolumes,
                    totalVolumes: volumes?.length || 0,
                    totalLuns: luns?.length || 0
                }
            })
        };
    }

    logger.info('topology data', { topologyData });
    return topologyData;
}

export default getDatabaseInstanceTopology;
