import { JOBSTATUS, JOBTYPE } from '@prisma/client';
import createError from 'http-errors';
import throat from 'throat';
import { isEmpty } from 'lodash-es';
import getLogger from '../../../utils/logger';
import {
    getInstanceInfo,
    getResources,
    updateDatabaseInstanceAssessmentResults
} from '../../database/database-operations';
import {
    DatabaseInstance,
    DatabaseInstanceConfigurations,
    DatabaseInstancesIncludingResource,
    Metadata,
    ResourceDetails,
    WorkloadInstance
} from '../../../utils/common-types';
import { AuditStatus, HttpErrorCodes, RESOURCESTYPE, DatabaseTypes, STORAGE_PROTOCOLS } from '../../../utils/consts';
import {
    AssessmentCategories,
    AssessmentCategoriesOracle,
    AssessmentTriggeredBy
} from '../../../utils/continous-optimization-consts';
import { registerJob, updateParentJobStatus } from '../../database/job-operations';
import { updateLongRunningAuditGroup } from '../../cloud-manager/audit-operations';
import { getOracleDatabaseMappedVolumes } from '../../workloads/oracle/oracle-operations';
import {
    OracleMappedOntapVolumeRecord,
    OracleMappedOntapVolumesResponse,
    OracleVolumeRecord
} from '../../workloads/oracle/common-types';
import { listDatabaseInstanceConfigData } from '../../../lib/database/database-instance-config';
import {
    calculateStorageDrift,
    initiateStorageAssessmentCollection,
    StorageAssessment
} from './storage-assessment-operations';
import {
    DriftAssessmentResponsePerAccountType,
    DriftAssessmentResponsePerHostType,
    OracleDriftAssessmentResponse,
    OracleDriftAssessmentResponseType,
    StorageParameterDriftResponseType
} from '../../../routes/types/oracle-continuous-optimization.types';
import { isDemo } from '../../../utils/utils';
import { ORACLE_MAPPED_ONTAP_VOLUMES_DATA } from '../../../utils/demo-utils/demoInventoryData';
import { getLatestInstanceAssessmentTime, validateAssessment } from '../assessment-utils';
import {
    updateFieldsBasedOnDismissedConfigurations,
    processDismissedConfigurations,
    mergeDismissConfigurations
} from '../assessment-dismiss-operations';
import { handleGetOracleAssessmentForDemo } from '../../demo-operations';
import { demoFsxId } from '../../../utils/demo-utils/demoMockdata';

const logger = getLogger();
const isDemoFlow = isDemo();

async function initiateInstanceLevelAssessmentDataCollection(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceRecord: WorkloadInstance,
    jobId: string,
    fields: string[]
) {
    const {
        id: databaseInstanceId,
        name: databaseInstanceName,
        resourceName,
        fsxFileSystem,
        databaseInstanceObject: { resource: resourceDetail } = {}
    } = databaseInstanceRecord;

    logger.info('Initiate instance level oracle assessment collection', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        jobId,
        fields,
        databaseInstanceId,
        fsxFileSystem
    });
    // Note- Need to check if structure of getmappedvolumes can be simplified
    let instanceVolumeMapping: OracleMappedOntapVolumeRecord;
    try {
        const response = (await getOracleDatabaseMappedVolumes(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            resourceDetail
        )) as Map<string, Map<string, OracleMappedOntapVolumesResponse>>;

        const allInstanceVolumeMappings =
            (response.get(databaseInstanceName)?.get(fsxFileSystem)?.volumeMappings as Record<
                string,
                OracleMappedOntapVolumeRecord
            >[]) || [];

        const protocol = response.get(databaseInstanceName)?.get(fsxFileSystem)?.protocol;

        if (isDemoFlow) {
            const mappedOntapVolumes = ORACLE_MAPPED_ONTAP_VOLUMES_DATA(
                demoFsxId,
                STORAGE_PROTOCOLS.ISCSI,
                'oradb',
                true
            ) as unknown as Map<string, OracleMappedOntapVolumesResponse>;
            instanceVolumeMapping =
                Object.values(mappedOntapVolumes)
                    .flatMap(volumeResponse => volumeResponse.volumeMappings || [])
                    .flatMap(volumeMapping => Object.values(volumeMapping))
                    .find(mapping => Object.keys(mapping as object).length > 0) || {};
        } else {
            instanceVolumeMapping =
                allInstanceVolumeMappings.find(mapping => mapping[databaseInstanceName])?.[databaseInstanceName] || {};
        }
        const { ontapVolumes = {}, isCDB = false } = instanceVolumeMapping || {};
        const extractVolumeData = (
            volumes: Record<string, OracleVolumeRecord[]> | Record<string, Record<string, OracleVolumeRecord[]>>
        ) =>
            Object.values(volumes).flatMap(pdb =>
                Object.values(pdb).flatMap(volumeGroup =>
                    Array.isArray(volumeGroup)
                        ? volumeGroup.map(vol => ({ id: vol.volumeId, name: vol.volumeName }))
                        : []
                )
            );

        const volumeData = isCDB
            ? extractVolumeData(ontapVolumes)
            : Object.values(ontapVolumes).flatMap(volumes =>
                  volumes.map((vol: any) => ({ id: vol.volumeId, name: vol.volumeName }))
              );

        databaseInstanceRecord.mappedVolumesUuids = [...new Set(volumeData.map(vol => vol.id))];
        databaseInstanceRecord.mappedVolumeNames = [...new Set(volumeData.map(vol => vol.name))];
        databaseInstanceRecord.storageProtocol = protocol;

        if (protocol === 'iSCSI') {
            const extractLunData = (
                volumes: Record<string, OracleVolumeRecord[]> | Record<string, Record<string, OracleVolumeRecord[]>>
            ) =>
                Object.values(volumes).flatMap(pdb =>
                    Object.values(pdb).flatMap(volumeGroup =>
                        Array.isArray(volumeGroup) ? volumeGroup.map(vol => ({ id: vol.lunId, name: vol.lunName })) : []
                    )
                );
            const lunData = isCDB ? extractLunData(ontapVolumes) : [];
            databaseInstanceRecord.mappedLunUuids = [...new Set(lunData.map(lun => lun.id))];
            databaseInstanceRecord.mappedLunNames = [...new Set(lunData.map(lun => lun.name))];
        }
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error while fetching mapped ontap volumes data', {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            errorMessage
        });
    }

    const instanceDetailsForJob = JSON.stringify({
        hostName: resourceName,
        resourceId: databaseHostId,
        databaseInstanceId,
        databaseInstanceName,
        sqlServerDeploymentType: RESOURCESTYPE.ORACLE
    });

    const resourceWithInstanceName = `${resourceName}\\${databaseInstanceName}`;
    const jobName = `Oracle assessment for database ${resourceWithInstanceName}`;
    const jobDescription = `${jobName}. Review detailed findings and recommendations in.;${instanceDetailsForJob}`;

    const { id: instanceLevelAssessmentJobId } = await registerJob(accountId, credentialsId, region, {
        name: jobName,
        description: jobDescription,
        resourceName: resourceWithInstanceName,
        startTime: Date.now(),
        status: JOBSTATUS.IN_PROGRESS,
        type: JOBTYPE.ASSESSMENT,
        parentJobId: jobId
    });
    const assessmentHandlers = {
        [AssessmentCategoriesOracle.STORAGE]: async () =>
            initiateStorageAssessmentCollection(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceLevelAssessmentJobId,
                databaseInstanceRecord
            )
    };
    await Promise.allSettled(
        fields.map(async field => {
            const handler = assessmentHandlers[field as keyof typeof assessmentHandlers];
            if (handler) {
                await handler();
            }
        })
    );

    await updateParentJobStatus(accountId, instanceLevelAssessmentJobId);
}

async function triggerOracleAssessment(
    managedInstance: DatabaseInstancesIncludingResource,
    parentJobId: string,
    fields: string[],
    isOnDemandAssessment = false,
    initiatedBy = AssessmentTriggeredBy.SYSTEM
) {
    const {
        account_id: accountId,
        credentials_id: credentialsId,
        region,
        resource_id: databaseHostId,
        database_instance_id: databaseInstanceId,
        database_instance_name: databaseInstanceName,
        fsx_svm_id: fsxSvmId,
        fsxn_ids: fsxFileSystem,
        storage_protocol: storageProtocol,
        resource = {}
    } = managedInstance;

    logger.info('Triggering drift assessment for oracle managed instance', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        parentJobId,
        fields
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.COMPLETED;
    let errorMessage = '';

    try {
        const {
            resource_name: resourceName,
            cloud_provider_account_id: cloudProviderAccountId,
            metadata,
            configurations: hostConfigurations
        } = resource as ResourceDetails;

        const { node1InstanceId: activeNodeInstanceId } = metadata as Metadata;

        const { configurations: instanceConfigurations } = managedInstance;

        const instanceDismissedConfigs = (instanceConfigurations as unknown as DatabaseInstanceConfigurations)
            ?.dismissedConfigurations;
        const hostDismissedConfigs = (hostConfigurations as unknown as DatabaseInstanceConfigurations)
            ?.dismissedConfigurations;

        // Process dismissed configurations using common method
        const finalDismissedConfigurations = await processDismissedConfigurations(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceDismissedConfigs,
            hostDismissedConfigs,
            databaseInstanceId
        );

        if (!isEmpty(finalDismissedConfigurations)) {
            fields = updateFieldsBasedOnDismissedConfigurations(
                fields,
                finalDismissedConfigurations,
                DatabaseTypes.ORACLE,
                storageProtocol ?? STORAGE_PROTOCOLS.ISCSI
            );
        }

        const instanceRecord: WorkloadInstance = {
            id: databaseInstanceId,
            name: databaseInstanceName,
            type: RESOURCESTYPE.ORACLE,
            region,
            sqlAuthEnabled: false,
            activeNodeInstanceid: activeNodeInstanceId!,
            fsxFileSystem: fsxFileSystem!,
            cloudProviderAccountId: cloudProviderAccountId || '',
            resourceName: resourceName || '',
            svmId: (fsxSvmId as Record<string, string>)[fsxFileSystem!] || '',
            databaseInstanceObject: managedInstance,
            storageProtocol: storageProtocol ?? STORAGE_PROTOCOLS.ISCSI
        };

        const shouldRunInstanceLevelAssessment = fields.some(field =>
            [AssessmentCategoriesOracle.STORAGE].includes(field.toLowerCase() as AssessmentCategoriesOracle)
        );

        if (shouldRunInstanceLevelAssessment) {
            await initiateInstanceLevelAssessmentDataCollection(
                accountId,
                credentialsId,
                region,
                databaseHostId,
                instanceRecord,
                parentJobId,
                fields
            );
        }
    } catch (error: any) {
        logger.error(error);
        errorMessage = error.message || 'Internal Server Error';
        jobStatus = JOBSTATUS.FAILED;
        if (!isOnDemandAssessment) {
            // If this is not an on-demand assessment, we throw the error to be handled by the caller
            throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
        }
    } finally {
        if (isOnDemandAssessment) {
            await updateParentJobStatus(accountId, parentJobId);
            if (initiatedBy === AssessmentTriggeredBy.USER) {
                updateLongRunningAuditGroup(
                    jobStatus === JOBSTATUS.COMPLETED ? AuditStatus.SUCCESS : AuditStatus.FAILED
                );
            }
        }
        await updateAssessmentResultsInInstanceMetadata(managedInstance);
    }
}

async function onDemandTriggerOracleDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    initiatedBy: string,
    fields?: string,
    parentJobId?: string
) {
    logger.info('On-demand trigger drift assessment', {
        accountId,
        credentialsId,
        region,
        databaseInstanceId,
        databaseHostId,
        initiatedBy,
        fields,
        parentJobId
    });
    try {
        const managedInstance = (await getInstanceInfo(
            accountId,
            credentialsId,
            databaseHostId,
            databaseInstanceId,
            region
        )) as DatabaseInstancesIncludingResource;

        const {
            resource: { resource_name: resourceName },
            database_instance_name: instanceName
        } = managedInstance;
        const savedInstanceName = `${resourceName}\\${instanceName}`;
        const jobName = `Oracle assessment for database ${savedInstanceName}`;
        const jobDescription = `${jobName}`;
        const { id: jobId } = await registerJob(accountId, credentialsId, region, {
            name: jobName,
            description: jobDescription,
            resourceName: savedInstanceName!,
            initiator: initiatedBy.toLocaleUpperCase(),
            startTime: Date.now(),
            status: JOBSTATUS.IN_PROGRESS,
            type: JOBTYPE.ASSESSMENT,
            parentJobId
        });
        await updateLongRunningAuditGroup(undefined, undefined, savedInstanceName);
        const fieldsValues = fields
            ? fields.toLowerCase().replace(/\s+/g, '').split(',')
            : Object.values(AssessmentCategoriesOracle).map(category => category.toLowerCase());
        // Call the async function without awaiting it
        triggerOracleAssessment(managedInstance, jobId, fieldsValues, true, AssessmentTriggeredBy.USER);

        return { jobId };
    } catch (error: any) {
        const errorMessage = `Error while triggering drift assessment for account ${accountId}, host ${databaseHostId}, instance ${databaseInstanceId}: ${error.message}`;
        logger.error(errorMessage);
        throw createError(error.statusCode || HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }
}

async function fetchOracleDriftAssessment(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    databaseInstanceId: string,
    fields?: string,
    databaseInstance?: DatabaseInstance
) {
    logger.info('Fetching oracle drift assessment', {
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        fields
    });

    const instanceDetail =
        databaseInstance ?? (await getInstanceInfo(accountId, credentialsId, databaseHostId, databaseInstanceId));

    let {
        database_instance_name: databaseInstanceName,
        fsxn_ids: fileSystemId,
        configurations: instanceConfigurations,
        database_deployment_type: databaseDeploymentType,
        storage_protocol: storageProtocol,
        resource: { configurations: hostConfigurations, metadata: resourceMetadata }
    } = instanceDetail as DatabaseInstance;

    const instanceDismissedConfigs = (instanceConfigurations as DatabaseInstanceConfigurations)
        ?.dismissedConfigurations;
    const hostDismissedConfigs = (hostConfigurations as DatabaseInstanceConfigurations)?.dismissedConfigurations;

    const { node1InstanceId } = resourceMetadata as Metadata;

    let fieldsValues =
        fields?.toLowerCase().replace(/\s+/g, '').split(',') ||
        Object.values(AssessmentCategoriesOracle).map(category => category.toLowerCase());

    const databaseInstanceConfigData = await listDatabaseInstanceConfigData({
        accountId,
        region,
        credentialsId,
        resourceId: databaseHostId,
        databaseInstanceIds: [databaseInstanceId]
    });

    const assessmentDataMap = databaseInstanceConfigData.reduce(
        (acc: Record<string, unknown>, config: { config_data_type: string; config_data: unknown }) => {
            acc[config.config_data_type] = acc[config.config_data_type] || config.config_data;
            return acc;
        },
        {} as Record<string, unknown>
    );

    const latestInstanceAssessmentTime = getLatestInstanceAssessmentTime(databaseInstanceConfigData);
    const mappedOntapVolumes = assessmentDataMap[AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES] as Record<
        string,
        OracleMappedOntapVolumesResponse
    >;

    storageProtocol = storageProtocol || (mappedOntapVolumes ? mappedOntapVolumes[fileSystemId]?.protocol : '');

    const dismissedConfigurations = mergeDismissConfigurations(instanceDismissedConfigs, hostDismissedConfigs);

    if (!isEmpty(dismissedConfigurations)) {
        fieldsValues = updateFieldsBasedOnDismissedConfigurations(
            fieldsValues,
            dismissedConfigurations,
            DatabaseTypes.ORACLE,
            storageProtocol ?? STORAGE_PROTOCOLS.ISCSI
        );
    }

    const assessmentFlags = {
        storage: fieldsValues.includes(AssessmentCategoriesOracle.STORAGE.toLowerCase())
    };

    const isASMManaged = mappedOntapVolumes ? mappedOntapVolumes[fileSystemId]?.isASMManaged : false;

    const storageDriftData = assessmentFlags.storage
        ? calculateStorageDrift(
              accountId,
              credentialsId,
              region,
              databaseHostId,
              node1InstanceId,
              databaseInstanceId,
              databaseInstanceName,
              fileSystemId,
              mappedOntapVolumes,
              assessmentDataMap[AssessmentCategoriesOracle.STORAGE] as StorageAssessment
          )
        : {};

    let driftAssessmentData: OracleDriftAssessmentResponseType = {
        storage: isEmpty(storageDriftData) ? undefined : (storageDriftData as StorageParameterDriftResponseType),
        dismissedConfigurations,
        fileSystemId,
        databaseInstanceName,
        ec2InstanceId: node1InstanceId,
        deploymentType: databaseDeploymentType,
        lastAssessmentTimestamp:
            latestInstanceAssessmentTime instanceof Date ? new Date(latestInstanceAssessmentTime).valueOf() : undefined,
        storageProtocol,
        isASMManaged
    };

    if (isDemoFlow) {
        driftAssessmentData = handleGetOracleAssessmentForDemo(accountId, instanceDetail, driftAssessmentData);
    }

    const { isValid, errors: validationErrors } = validateAssessment(
        OracleDriftAssessmentResponse,
        driftAssessmentData
    );
    if (!isValid) {
        logger.error('Assessment data validation failed for', { databaseHostId, databaseInstanceId, validationErrors });
        return {};
    }

    return driftAssessmentData;
}

async function updateAssessmentResultsInInstanceMetadata(managedInstance: DatabaseInstancesIncludingResource) {
    const {
        account_id: accountId,
        region,
        credentials_id: credentialsId,
        resource_id: databaseHostId,
        database_instance_id: databaseInstanceId
    } = managedInstance;
    logger.info('Update assessment results in instance metadata', {
        accountId,
        credentialsId,
        databaseHostId,
        databaseInstanceId
    });

    const driftAssessmentData = await fetchOracleDriftAssessment(
        accountId,
        credentialsId,
        region,
        databaseHostId,
        databaseInstanceId,
        undefined,
        managedInstance as unknown as DatabaseInstance
    );

    try {
        await updateDatabaseInstanceAssessmentResults(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId,
            driftAssessmentData
        );
    } catch (error) {
        logger.error('Error while updating assessment results in instance table', {
            accountId,
            databaseHostId,
            databaseInstanceId,
            error
        });
    }
}

async function fetchOracleDriftAssessmentPerHost(
    accountId: string,
    credentialsId: string,
    region: string,
    databaseHostId: string,
    resourceDetail?: ResourceDetails
) {
    logger.info('Fetching oracle drift assessment per host', { accountId, credentialsId, region, databaseHostId });

    if (!resourceDetail) {
        const { items: [resource] = [] } = await getResources({
            accountId,
            resourceId: databaseHostId,
            credentialsId,
            region,
            resourceType: RESOURCESTYPE.ORACLE,
            includeDatabaseInstances: true,
            allRecords: false,
            assessmentData: true
        });

        if (!resource) {
            throw createError(
                HttpErrorCodes.NOT_FOUND,
                `No oracle database host by id ${databaseHostId} for ${accountId} is found.`
            );
        }
        resourceDetail = resource;
    }

    const { resource_name: databaseHostName = '', database_instances: instancesManaged = [] } = resourceDetail;

    if (isEmpty(instancesManaged)) {
        throw createError(
            HttpErrorCodes.NOT_FOUND,
            `No managed oracle databases found for account ${accountId} and host ${databaseHostId}.`
        );
    }

    const driftAssessments = await Promise.all(
        instancesManaged.map(
            throat(3, async instance => {
                const { database_instance_id: databaseInstanceId, database_instance_name: databaseInstanceName } =
                    instance;
                try {
                    const driftAssessment = await fetchOracleDriftAssessment(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        databaseInstanceId,
                        AssessmentCategories.STORAGE,
                        { ...instance, resource: resourceDetail } as DatabaseInstancesIncludingResource
                    );
                    return { databaseInstanceId, databaseInstanceName, assessments: driftAssessment };
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    logger.error(
                        `Error while fetching oracle drift assessment for ${databaseInstanceId}: ${errorMessage}`
                    );
                    return { databaseInstanceId, databaseInstanceName, error: errorMessage };
                }
            })
        )
    );

    return {
        databaseHostId,
        databaseHostName,
        instancesAssessment: driftAssessments
    } as DriftAssessmentResponsePerHostType;
}

async function fetchOracleDriftAssessmentPerAccount(
    accountId: string,
    credentialsId: string,
    region: string,
    clientNextToken?: string,
    pageSize?: number
) {
    logger.info('Fetching oracle drift assessment per account', {
        accountId,
        credentialsId,
        region,
        clientNextToken,
        pageSize
    });

    const { items: resourceDetails = [], nextToken } = await getResources({
        accountId,
        credentialsId,
        region,
        resourceType: RESOURCESTYPE.ORACLE,
        pageSize: pageSize || 50,
        nextToken: clientNextToken,
        includeDatabaseInstances: true
    });

    if (isEmpty(resourceDetails)) {
        logger.info(`No successfully deployed database hosts found for account ${accountId} in region ${region}.`);
        return { count: 0, assessmentsPerAccount: [], nextToken: '' };
    }

    const driftAssessmentPerAccount = await Promise.all(
        resourceDetails.map(
            throat(3, async resourceDetail => {
                const { resource_id: databaseHostId } = resourceDetail;
                try {
                    return await fetchOracleDriftAssessmentPerHost(
                        accountId,
                        credentialsId,
                        region,
                        databaseHostId,
                        resourceDetail
                    );
                } catch (error) {
                    logger.error(
                        `Error while fetching drift assessment per host ${accountId}, ${databaseHostId}, ${error}`
                    );
                }
            })
        )
    );

    const filteredAssessments = driftAssessmentPerAccount.filter(Boolean);

    return {
        count: filteredAssessments.length,
        assessmentsPerAccount: filteredAssessments,
        nextToken
    } as DriftAssessmentResponsePerAccountType;
}

export {
    triggerOracleAssessment,
    onDemandTriggerOracleDriftAssessment,
    fetchOracleDriftAssessment,
    fetchOracleDriftAssessmentPerHost,
    fetchOracleDriftAssessmentPerAccount,
    initiateInstanceLevelAssessmentDataCollection
};
