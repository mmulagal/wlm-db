import { STORAGE_TYPE } from '@prisma/client';
import { describeSubnets } from '../../../lib/aws/ec2';
import { describeFSx } from '../../../lib/aws/fsx';
import { FileSystemTypes, NOT_AVAILABLE } from '../../../utils/consts';
import getLogger from '../../../utils/logger';
import { DatabaseInstance } from '../../../utils/common-types';

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
        database_instance_id: databaseInstanceDetails,
        database_deployment_type: databaseDeploymentType,
        database_type: databaseType,
        fsxwId
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
                const fsxInfo = await describeFSx(credentialsId, region, {
                    FileSystemIds: [(fileSystemId || fsxwId) as string]
                });
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

                logger.info('availabilityZones', availabilityZones);
            }
        } catch (error) {
            logger.error(`Error while fetching details for fsx. Error: ${error}`, databaseInstanceDetails);
        }

        topologyData = {
            ...topologyData,
            ...(fileSystemName && { fileSystemName }),
            ...(fileSystemDeploymentMode && { fileSystemDeploymentMode }),
            ...(fileSystemStatus && { fileSystemStatus }),
            ...(fileSystemStorageCapacity && { fileSystemStorageCapacity }),
            ...(fileSystemThroughputCapacity && { fileSystemThroughputCapacity }),
            ...(availabilityZones && { availabilityZone: availabilityZones }),
            ...(fileSystemStorageType && { fileSystemStorageType })
        };
    }
    return topologyData;
}

export default getDatabaseInstanceTopology;
