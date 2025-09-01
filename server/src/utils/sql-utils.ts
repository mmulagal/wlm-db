import { isEmpty } from 'lodash-es';
import { STORAGE_TYPE } from '@prisma/client';
import { describeSubnets } from '../lib/aws/ec2';
import { describeFSx } from '../lib/aws/fsx';
import { DatabaseTypes, FileSystemTypes, NOT_AVAILABLE } from './consts';
import getLogger from './logger';
import { DatabaseInstance, MappedOnTapVolumeResponse } from './common-types';
import { listDatabaseInstanceConfigData } from '../lib/database/database-instance-config';
import { AssessmentCategories } from './continous-optimization-consts';
import { OracleMappedOntapVolumesResponse, OracleVolumeRecord } from '../operations/workloads/oracle/common-types';
import { getFsxNameFromTags, isDemo } from './utils';

const logger = getLogger();
const isDemoFlow = isDemo();

async function getDatabaseInstanceTopology(
    accountId: string,
    credentialsId: string,
    region: string,
    activeNodeInstanceId: string,
    databaseInstances: DatabaseInstance,
    dbEngine: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
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

                fileSystemName = getFsxNameFromTags(fileSystemTags);

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

        const [{ config_data: mappedStorageDetails } = { config_data: {} }] = (await listDatabaseInstanceConfigData({
            accountId,
            credentialsId,
            region,
            resourceId,
            databaseInstanceId,
            configDataType: AssessmentCategories.MAPPED_ONTAP_VOLUMES
        })) || [{}];
        const { combinedOntapVolumes, luns } = parseMappedVolumeData(
            mappedStorageDetails,
            fileSystemId || '',
            dbEngine
        );

        topologyData = {
            ...topologyData,
            ...(fileSystemName && { fileSystemName }),
            ...(fileSystemDeploymentMode && { fileSystemDeploymentMode }),
            ...(fileSystemStatus && { fileSystemStatus }),
            ...(fileSystemStorageCapacity && { fileSystemStorageCapacity }),
            ...(fileSystemThroughputCapacity && { fileSystemThroughputCapacity }),
            ...(availabilityZones && { availabilityZone: availabilityZones }),
            ...(fileSystemStorageType && { fileSystemStorageType }),
            ...(!isEmpty(combinedOntapVolumes) && {
                storageSummary: {
                    volumes: combinedOntapVolumes,
                    totalVolumes: combinedOntapVolumes?.length || 0,
                    totalLuns: luns?.length || 0
                }
            })
        };
    }

    return topologyData;
}

function parseMappedVolumeData(configData: any, fsxId: string, dbType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER) {
    let combinedOntapVolumes: any[] = [];
    let luns: any[] = [];
    switch (dbType) {
        case DatabaseTypes.ORACLE: {
            const storageDetails: OracleMappedOntapVolumesResponse = isDemoFlow
                ? Object.values(configData)[0]
                : configData?.[fsxId];
            if (!storageDetails) {
                return { combinedOntapVolumes, luns };
            }
            const processVolumeRecords = (fileType: string, volumeRecords: OracleVolumeRecord[], tenancy: string) => {
                volumeRecords.forEach((record: OracleVolumeRecord) => {
                    if (!combinedOntapVolumes.some(v => v.id === record.volumeId)) {
                        luns = luns.some(lun => lun.id === record.lunId)
                            ? luns
                            : [...luns, { id: record.lunId, name: record.lunName }];
                        combinedOntapVolumes.push({
                            id: record.volumeId,
                            name: record.volumeName,
                            luns: [{ id: record.lunId, name: record.lunName }]
                        });
                    }
                });
                logger.debug(`${tenancy}, File Type: ${fileType}`);
            };
            storageDetails?.volumeMappings?.forEach(volumeMapping => {
                Object.entries(volumeMapping).forEach(([sid, sidMappedOntapVolumeRecord]) => {
                    const { ontapVolumes, isCDB } = sidMappedOntapVolumeRecord || {};
                    if (!ontapVolumes) {
                        return;
                    }
                    if (isCDB) {
                        Object.entries(ontapVolumes).forEach(([pdb, pdbMappedOntapVolumeRecord]) => {
                            if (!pdbMappedOntapVolumeRecord) {
                                return;
                            }
                            Object.entries(pdbMappedOntapVolumeRecord).forEach(([fileType, volumeRecord]) => {
                                processVolumeRecords(fileType, volumeRecord as OracleVolumeRecord[], pdb);
                            });
                        });
                    } else {
                        Object.entries(ontapVolumes).forEach(([fileType, volumeRecord]) => {
                            processVolumeRecords(fileType, volumeRecord, sid);
                        });
                    }
                });
            });
            break;
        }
        case DatabaseTypes.MS_SQL_SERVER:
        default: {
            const extractRecords = (records: Array<{ uuid: string; name: string }> = []) =>
                records.map(({ uuid, name }) => ({ id: uuid, name }));

            const mappedDetails = Object.values(configData as MappedOnTapVolumeResponse) || [];
            const volumes = mappedDetails.flatMap(i => extractRecords(i?.volumeRecords));
            luns = mappedDetails.flatMap(i => extractRecords(i?.lunRecords));
            combinedOntapVolumes = volumes.map(volume => ({
                ...volume,
                luns: luns
                    .filter(lun => lun.name.includes(volume.name))
                    .map(lun => ({
                        ...lun,
                        name: lun.name.split('/').pop() // Extract the last part of the lun name
                    }))
            }));
        }
    }
    return {
        combinedOntapVolumes,
        luns
    };
}

export default getDatabaseInstanceTopology;
