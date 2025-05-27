import throat from 'throat';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE, STORAGE_TYPE } from '@prisma/client';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import { compact, isEmpty } from 'lodash-es';
import {
    derivePropertiesFromARN,
    generateSqlResourceId,
    getArtifactsRegionBucketName,
    isDemo,
    retryWithDelay
} from '../utils/utils';
import { registerJob, updateJobDetails, updateParentJobStatus } from './database/job-operations';
import { MultiInstanceManageMsSqlRequestBodyType, SqlServerInstanceInfoType } from '../routes/types/discover.types';
import getLogger from '../utils/logger';
import {
    CloudProviders,
    DatabaseTypes,
    HttpErrorCodes,
    POWERSHELL_7_RELATIVE_PATH,
    PREPARE_PSMODULES_RELATIVE_PATH,
    RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES,
    RESOURCE_SOURCE,
    RESOURCESTYPE,
    SqlServerDeploymentModel
} from '../utils/consts';
import { callSsmExecution, getSSMConnectionStatus } from './aws/ssm-operations';
import { describeInstance, paginateDescribeEbsVolumes } from '../lib/aws/ec2';
import { getHostAndSqlServerInfo } from './discover-operations';
import {
    ACTIVE_DIRECTORY,
    CHECK_POWERSHELL7_AVAILABLE,
    FAILURE_INFO,
    GET_ACTIVE_DIRECTORY_DETAILS,
    INSTALL_POWERSHELL_7,
    INSTALL_WF_POWERSHELL_PREREQS_PS1,
    IS_PS7_AVAILABLE,
    REQUIRED_PS_MODULES_FOR_MANAGEMENT
} from './workloads/mssql/discover-consts';
import { getResources } from './database/database-operations';
import { createResource, listDatabaseInstances, upsertDatabaseInstance } from '../lib/database/db';
import { tagResources } from './aws/sqs-operations';
import { createAssessmentData } from './demo-operations';
import { preSignedUrl } from '../lib/aws/s3';
import { DatabaseInstance } from '../utils/common-types';
import { getInstanceDetailsByPrivateIp } from './aws/ec2-operations';

const logger = getLogger();
const isDemoFlow = isDemo();

const { getPreSignedUrl } = preSignedUrl;

async function installPowershell7(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    parentJobId: string
) {
    logger.info(`Installing PowerShell 7.5.0 on ${ec2InstanceId}`);

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.REGISTER_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: ec2InstanceId,
        name: `Install PowerShell 7.5.0 for ${ec2InstanceId}`,
        description: 'Install PowerShell 7.5.0 for Workload Factory database operations.',
        parentJobId,
        startTime: Date.now()
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let errorMessage = '';
    try {
        // Get signed url for dependent-packages.zip to install the ps modules
        const bucketname = getArtifactsRegionBucketName(region);
        const copyPowershell7SignedUrl = await getPreSignedUrl(region, bucketname, POWERSHELL_7_RELATIVE_PATH);

        const installResponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                INSTALL_POWERSHELL_7(copyPowershell7SignedUrl),
                ec2InstanceId,
                `Install PowerShell 7.5.0 for ${ec2InstanceId}`,
                accountId,
                false
            )
        );

        if (installResponse?.includes(FAILURE_INFO)) {
            throw new Error(JSON.parse(installResponse)[FAILURE_INFO]);
        }

        const checkResponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                CHECK_POWERSHELL7_AVAILABLE,
                ec2InstanceId,
                'Check PowerShell 7 availability after installation',
                accountId,
                false
            )
        );

        const parsedResponse = JSON.parse(checkResponse);
        const isPS7Available = parsedResponse?.[IS_PS7_AVAILABLE];
        jobStatus = isPS7Available ? JOBSTATUS.COMPLETED : JOBSTATUS.FAILED;
        errorMessage = parsedResponse.includes(FAILURE_INFO) ? parsedResponse[FAILURE_INFO] : '';
    } catch (error: any) {
        logger.error(`Failed to install PowerShell 7.5.0 on ${ec2InstanceId}: ${error.message}`);
        jobStatus = error.message.includes('PowerShell 7 is already installed') ? JOBSTATUS.WARNING : JOBSTATUS.FAILED;
        errorMessage = error.message;
    } finally {
        await updateJobDetails(accountId, childJobId, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
    }

    return jobStatus;
}

async function installPowerShellModules(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    hostJobId: string,
    modulesToInstall: string[]
) {
    logger.info('Installing powerShell modules', { accountId, credentialsId, region, ec2InstanceId, modulesToInstall });

    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let errorMessage = '';
    const { id: installPSPackagesJobid } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.REGISTER_RESOURCE,
        status: jobStatus,
        resourceName: ec2InstanceId,
        name: `Install PowerShell modules for ${ec2InstanceId}`,
        description: 'Install PowerShell modules for Workload Factory database operations.',
        parentJobId: hostJobId,
        startTime: Date.now()
    });

    let ssmPsModuleInstallResponse;
    try {
        // Get signed url for dependent-packages.zip to install the ps modules
        const bucketname = getArtifactsRegionBucketName(region);
        const copyPSModuleS3SignedUrl = await getPreSignedUrl(region, bucketname, PREPARE_PSMODULES_RELATIVE_PATH);

        ssmPsModuleInstallResponse = await retryWithDelay(
            callSsmExecution.bind(
                null,
                credentialsId,
                region,
                INSTALL_WF_POWERSHELL_PREREQS_PS1(REQUIRED_PS_MODULES_FOR_MANAGEMENT, copyPSModuleS3SignedUrl),
                ec2InstanceId,
                `Install PowerShell modules for ${ec2InstanceId}`,
                accountId,
                false,
                (RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES * 60).toString()
            )
        );

        jobStatus = JOBSTATUS.COMPLETED;
        if (ssmPsModuleInstallResponse?.includes(FAILURE_INFO)) {
            errorMessage = JSON.parse(ssmPsModuleInstallResponse)[FAILURE_INFO];
            jobStatus = JOBSTATUS.FAILED;
        }
    } catch (error: any) {
        errorMessage = error.message;
        jobStatus = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, installPSPackagesJobid, {
            status: jobStatus,
            endTime: Date.now(),
            error: errorMessage
        });
    }
    return ssmPsModuleInstallResponse;
}

async function powershellInstallations(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    hostJobId: string,
    modulesToInstall: string[] | undefined
) {
    logger.info('Powershell installations', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        hostJobId,
        modulesToInstall
    });
    const shouldInstallPowershell7 = modulesToInstall?.includes('Powershell 7');
    const shouldInstallPowershellModules = modulesToInstall?.some(module => module !== 'Powershell 7');
    const psModulesToInstall = modulesToInstall?.filter(module => module !== 'Powershell 7');

    const [powershellInstallationResponse, modulesInstallationResponse] = await Promise.all([
        shouldInstallPowershell7
            ? installPowershell7(accountId, credentialsId, region, ec2InstanceId, hostJobId)
            : Promise.resolve(),
        shouldInstallPowershellModules
            ? installPowerShellModules(
                  accountId,
                  credentialsId,
                  region,
                  ec2InstanceId,
                  hostJobId,
                  psModulesToInstall ?? []
              )
            : Promise.resolve()
    ]);
    return { powershellInstallationResponse, modulesInstallationResponse };
}

async function getPartnerNodeDetails(
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    sqlServerInstances: SqlServerInstanceInfoType[]
) {
    logger.info('Get partner node details', {
        credentialsId,
        region,
        ec2InstanceId,
        sqlServerInstancesLength: sqlServerInstances.length
    });
    const fciInstanceDetails = sqlServerInstances
        .filter(
            ({ sqlServerDeploymentType, windowsClusterNodes }) =>
                sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT && windowsClusterNodes
        )
        .map(({ sqlServerInstance, windowsClusterNodes }) => ({
            databaseInstanceName: sqlServerInstance,
            clusterIps: !Array.isArray(windowsClusterNodes)
                ? [windowsClusterNodes]
                : windowsClusterNodes.map(node => node?.Address),
            partnerEc2InstanceId: ''
        }));

    // Extract all cluster IPs from the FCI instance details and flatten the array.
    const clusterIps = [...new Set(fciInstanceDetails.map(fciInstance => fciInstance.clusterIps).flat())];

    // Fetch details of EC2 instances corresponding to the cluster IPs using their private IP addresses.
    const clusterNodeDetails = await getInstanceDetailsByPrivateIp(credentialsId, region, compact(clusterIps));

    // Iterate over each FCI instance to determine the partner EC2 instance ID.
    // For each FCI instance, filter the cluster node details to find nodes that:
    // - Are not the current EC2 instance (ec2InstanceId).
    // - Have a private IP address matching one of the cluster IPs of the FCI instance.
    // Map the matching nodes to their EC2 instance IDs and assign the first match
    // as the partner EC2 instance ID for the FCI instance.
    fciInstanceDetails.forEach(fciInstance => {
        const partnerNode = clusterNodeDetails.find(
            node =>
                ec2InstanceId !== node.ec2InstanceId &&
                fciInstance.clusterIps.includes(node.ec2InstancePrivateIpAddress)
        );
        fciInstance.partnerEc2InstanceId = partnerNode?.ec2InstanceId ?? '';
    });
    return fciInstanceDetails;
}

async function getEbsVolumeDetails(credentialsId: string, region: string, node1InstanceId: string) {
    logger.info('Get EBS volume details', { credentialsId, region, node1InstanceId });
    const ebsVolumes = await paginateDescribeEbsVolumes(credentialsId, region, {
        Filters: [{ Name: 'attachment.instance-id', Values: [node1InstanceId] }]
    });
    const ebsVolumesFiltered = ebsVolumes?.map(volume => ({
        iops: volume.Iops,
        size: volume.Size,
        isRoot: volume.Attachments?.some(
            attachment => attachment.Device === '/dev/xvda' || attachment.Device === '/dev/sda1'
        ),
        volumeType: volume.VolumeType,
        volumeId: volume.VolumeId,
        throughput: volume.Throughput
    }));
    return ebsVolumesFiltered;
}

async function manageSqlInstance(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    databaseInstanceNames: string[],
    modulesToInstall: string[] | undefined,
    parentManageJobId: string,
    hostJobId: string,
    databaseHostId?: string
) {
    logger.info('Register SQL instances', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        databaseInstanceNames,
        modulesToInstall,
        parentManageJobId,
        hostJobId,
        databaseHostId
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    const instanceManagementStatus: {
        databaseInstanceName: string;
        databaseInstanceGuid?: string;
        status: string;
        errorMessage?: string;
    }[] = [];

    let resourceId: string = '';
    try {
        const ssmStatus = await getSSMConnectionStatus(credentialsId, region, ec2InstanceId);
        if (ssmStatus.Status === ConnectionStatus.NOT_CONNECTED) {
            throw createError(HttpErrorCodes.VALIDATION_ERROR, 'No SSM connectivity.');
        }

        const [ec2Details, discoverDetails, adDetails] = await Promise.all([
            describeInstance(credentialsId, region, { InstanceIds: [ec2InstanceId] }),
            getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [ec2InstanceId]),
            callSsmExecution(
                credentialsId,
                region,
                GET_ACTIVE_DIRECTORY_DETAILS,
                ec2InstanceId,
                'Get AD details',
                accountId
            )
        ]);

        const node1InstanceId = ec2InstanceId;
        const { awsAccountId } =
            derivePropertiesFromARN(ec2Details?.Reservations?.[0]?.Instances?.[0]?.IamInstanceProfile?.Arn || '') || {};
        const [{ sqlServerInstances } = {}] = discoverDetails.items || [];
        resourceId = isDemoFlow && databaseHostId ? databaseHostId : generateSqlResourceId(node1InstanceId, undefined);

        let isResourceTobeCreated = !(isDemoFlow && databaseHostId);
        let alreadyManagedDatabaseInstances: DatabaseInstance[] = [];
        if (!isDemoFlow || !databaseHostId) {
            const {
                items: [resourceDetails]
            } = await getResources(accountId, resourceId, credentialsId, region, undefined, undefined, undefined, true);
            isResourceTobeCreated = !resourceDetails;
            if (resourceDetails && Array.isArray(resourceDetails.databaseInstanceDetails)) {
                alreadyManagedDatabaseInstances = resourceDetails.databaseInstanceDetails;
            }
        }

        if (alreadyManagedDatabaseInstances.length === 0) {
            alreadyManagedDatabaseInstances = await listDatabaseInstances(accountId, {
                credentialsId,
                resourceId,
                region
            });
        }

        // Filter SQL Server instances: not already managed, storage is FSXN, deployment is Standalone or FCI
        const eligibleSqlInstances = (sqlServerInstances || []).filter((sqlInst: any) => {
            const isAlreadyManaged = alreadyManagedDatabaseInstances.some(
                elem => elem.database_instance_name === sqlInst.sqlServerInstance
            );
            const hasFsxnStorage = (sqlInst.storage || []).some((storage: any) => storage.type === STORAGE_TYPE.FSXN);
            const isSupportedDeployment = sqlInst.sqlServerDeploymentType !== SqlServerDeploymentModel.SQL_AOAG_SHORT;
            return !isAlreadyManaged && hasFsxnStorage && isSupportedDeployment;
        });

        const fciInstanceDetails = await getPartnerNodeDetails(
            credentialsId,
            region,
            ec2InstanceId,
            eligibleSqlInstances
        );

        let powershellInstallationResponse;
        let modulesInstallationResponse;
        if (eligibleSqlInstances.length && modulesToInstall && !isEmpty(modulesToInstall)) {
            ({ powershellInstallationResponse, modulesInstallationResponse } = await powershellInstallations(
                accountId,
                credentialsId,
                region,
                ec2InstanceId,
                hostJobId,
                modulesToInstall
            ));
        }

        for (const dbInst of databaseInstanceNames) {
            let instanceJobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
            let instanceErrorMessage = '';
            const sqlInstanceInfo = sqlServerInstances?.find(
                (sqlInst: { sqlServerInstance: string }) => sqlInst.sqlServerInstance === dbInst
            );

            if (
                !sqlInstanceInfo ||
                alreadyManagedDatabaseInstances.some(elem => elem.database_instance_name === dbInst)
            ) {
                const errorMsg = !sqlInstanceInfo
                    ? 'SQL Server instance not found.'
                    : 'Instance is already registered.';
                throw new Error(errorMsg);
            }

            try {
                const { windowsAuthentication, sqlServerAuthentication, windowsDomainUserAuthentication, serverGuid, storage } = sqlInstanceInfo;
                const storageInfo = storage?.find((elem: { type: string }) => elem.type === STORAGE_TYPE.FSXN);
                const storageProtocols = storage
                    ?.filter((elem: { type: string }) => elem.type === STORAGE_TYPE.FSXN)
                    .map((elem: any) => elem.protocol);

                // Combine all failure conditions for early exit
                let failureReason: string | undefined;

                if (!windowsAuthentication && !sqlServerAuthentication && !windowsDomainUserAuthentication) {
                    failureReason =
                        'Unable to authenticate with the SQL Server instance. Windows authentication or SQL Server authentication is required.';
                } else if (!storageInfo) {
                    failureReason = 'SQL Server instance is not hosted on FSx for NetApp.';
                } else if (sqlInstanceInfo.sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
                    failureReason = 'Always On availability group environments are not supported.';
                } else if (
                    modulesInstallationResponse &&
                    modulesToInstall?.includes('AWS.Tools.SimpleSystemsManagement') &&
                    !modulesInstallationResponse.availablePSModules.includes('AWS.Tools.SimpleSystemsManagement')
                ) {
                    failureReason = modulesInstallationResponse.failureInfo;
                }

                if (failureReason) {
                    throw new Error(failureReason);
                }
                let partnerPowershellInstallationResponse;
                let partnerModulesInstallationResponse;
                if (storageInfo) {
                    if (sqlInstanceInfo.sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
                        const fciInstance = fciInstanceDetails.find(
                            instance => instance.databaseInstanceName === dbInst
                        );
                        const partnerEc2InstanceId = fciInstance?.partnerEc2InstanceId;

                        if (fciInstanceDetails.length === 0 || !fciInstance || !partnerEc2InstanceId) {
                            failureReason = 'FCI instance details not found or partner EC2 instance ID is missing.';
                            throw new Error(failureReason);
                        }

                        resourceId = generateSqlResourceId(node1InstanceId, partnerEc2InstanceId);

                        ({
                            powershellInstallationResponse: partnerPowershellInstallationResponse,
                            modulesInstallationResponse: partnerModulesInstallationResponse
                        } = await powershellInstallations(
                            accountId,
                            credentialsId,
                            region,
                            partnerEc2InstanceId,
                            hostJobId,
                            modulesToInstall
                        ));

                        // Check if the partner EC2 instance has the required PowerShell module installed.
                        // If the module "AWS.Tools.SimpleSystemsManagement" is specified in the modulesToInstall list
                        // and is not available in the partnerModulesInstallationResponse, throw an error with the failure reason.
                        if (
                            partnerModulesInstallationResponse &&
                            modulesToInstall?.includes('AWS.Tools.SimpleSystemsManagement') &&
                            !partnerModulesInstallationResponse.availablePSModules.includes(
                                'AWS.Tools.SimpleSystemsManagement'
                            )
                        ) {
                            failureReason = partnerModulesInstallationResponse.failureInfo;
                            throw new Error(failureReason);
                        }
                    }
                    let activeDirectoryDomainName: string | undefined;
                    let activeDirectoryIpAddresses: string[] | undefined = [];
                    if (isResourceTobeCreated) {
                        if (adDetails && !adDetails.includes(ACTIVE_DIRECTORY)) {
                            ({ domainName: activeDirectoryDomainName, ipAddresses: activeDirectoryIpAddresses } =
                                JSON.parse(adDetails!)[ACTIVE_DIRECTORY]);
                        }
                        const ebsVolumesFiltered = await getEbsVolumeDetails(credentialsId, region, node1InstanceId);

                        await createResource(accountId, {
                            resourceId,
                            credentialsId,
                            storageType: STORAGE_TYPE.FSXN,
                            resourceName: sqlInstanceInfo.sqlServerName,
                            cloudProviderAccountId: awsAccountId!,
                            cloudProviderName: CloudProviders.AWS,
                            resourceType: RESOURCESTYPE.MSSQL,
                            coRelationId: storageInfo.id,
                            region,
                            metadata: {
                                creationDate: Date.now(),
                                node1InstanceId,
                                sqlDeploymentType: sqlInstanceInfo.sqlServerDeploymentType,
                                source: RESOURCE_SOURCE.DISCOVER,
                                fsxSvmId: storageInfo.svmId,
                                storageProtocol: storageProtocols ? storageProtocols.join() : '',
                                ...(activeDirectoryDomainName && {
                                    activeDirectoryName: activeDirectoryDomainName
                                }),
                                ...(activeDirectoryIpAddresses && {
                                    activeDirectoryAddress: activeDirectoryIpAddresses.join()
                                }),
                                ...(ebsVolumesFiltered && { ebsVolumes: ebsVolumesFiltered })
                            }
                        });
                        isResourceTobeCreated = false;
                    }

                    tagResources(credentialsId, region, awsAccountId!, accountId, storageInfo.id, node1InstanceId);

                    const dbInstanceName = isDemoFlow
                        ? sqlInstanceInfo.sqlServerInstance !== 'MSSQLSERVER'
                            ? sqlInstanceInfo.sqlServerName + sqlInstanceInfo.sqlServerInstance
                            : sqlInstanceInfo.sqlServerInstance
                        : sqlInstanceInfo.sqlServerInstance;

                    await upsertDatabaseInstance(accountId, {
                        credentialsId,
                        resourceId,
                        region,
                        databaseInstanceId: serverGuid!,
                        databaseInstanceName: dbInstanceName,
                        fsxnIds: storageInfo.id,
                        isDefault: sqlInstanceInfo.isDefaultInstance,
                        source: RESOURCE_SOURCE.DISCOVER,
                        sqlDeploymentType: sqlInstanceInfo.sqlServerDeploymentType!,
                        fsxSvmId: { [storageInfo.id]: storageInfo.svmId },
                        storageProtocol: storageProtocols ? storageProtocols.join() : '',
                        databaseType: DatabaseTypes.MS_SQL_SERVER
                    });
                    if (isDemoFlow) {
                        await createAssessmentData(accountId, credentialsId, region, resourceId, serverGuid!);
                    }
                    const isWarning = [powershellInstallationResponse, partnerPowershellInstallationResponse].some(
                        status => status === JOBSTATUS.FAILED || status === JOBSTATUS.WARNING
                    );

                    instanceManagementStatus.push({
                        databaseInstanceName: dbInst,
                        databaseInstanceGuid: serverGuid,
                        status: isWarning ? JOBSTATUS.WARNING : JOBSTATUS.COMPLETED
                    });

                    instanceJobStatus = JOBSTATUS.COMPLETED;
                }
            } catch (error: any) {
                logger.error('Error while managing SQL instance', {
                    accountId,
                    credentialsId,
                    region,
                    ec2InstanceId,
                    dbInst,
                    modulesToInstall,
                    error: error.message
                });
                instanceManagementStatus.push({
                    databaseInstanceName: dbInst,
                    status: JOBSTATUS.FAILED,
                    errorMessage: `${error}`
                });
                instanceJobStatus = JOBSTATUS.FAILED;
                instanceErrorMessage = `${error}`;
            } finally {
                await registerJob(accountId, credentialsId, region, {
                    type: JOBTYPE.REGISTER_RESOURCE,
                    status: instanceJobStatus,
                    resourceName: accountId,
                    parentJobId: hostJobId,
                    name: `Register instance ${dbInst}`,
                    startTime: Date.now(),
                    description: `Register instance ${dbInst}`,
                    error: instanceErrorMessage,
                    endTime: Date.now()
                });
            }
        }
    } catch (error: any) {
        jobStatus = JOBSTATUS.FAILED;
        databaseInstanceNames.forEach(databaseInstanceName =>
            instanceManagementStatus.push({
                databaseInstanceName,
                databaseInstanceGuid: '',
                status: jobStatus,
                errorMessage: error.message
            })
        );
        logger.error('Error while managing SQL instances', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            databaseInstanceNames,
            modulesToInstall,
            error: error.message
        });
    } finally {
        jobStatus = instanceManagementStatus.every(elem => elem.status === JOBSTATUS.FAILED)
            ? JOBSTATUS.FAILED
            : instanceManagementStatus.every(elem => elem.status === JOBSTATUS.COMPLETED)
            ? JOBSTATUS.COMPLETED
            : JOBSTATUS.WARNING;

        const errorMessage = instanceManagementStatus
            .filter(elem => elem.status === JOBSTATUS.FAILED)
            .map(elem => `${elem.databaseInstanceName}: ${elem.errorMessage}`)
            .join(', ');
        await updateJobDetails(accountId, hostJobId, {
            status: jobStatus,
            error: errorMessage,
            metadata: {
                ec2InstanceId,
                databaseInstanceNames,
                modulesToInstall,
                instanceManagementStatus,
                resourceId
            }
        });
        await updateParentJobStatus(accountId, parentManageJobId);
    }
}

async function installAndManageSqlInstances(
    accountId: string,
    parentManageJobId: string,
    resourcesToBeManaged: MultiInstanceManageMsSqlRequestBodyType[]
) {
    logger.info('Install and register sql instances', {
        accountId,
        parentManageJobId,
        resourcesToBeManaged: resourcesToBeManaged.length
    });

    await Promise.all(
        resourcesToBeManaged.map(
            throat(3, async resource => {
                const {
                    credentialsId,
                    region,
                    ec2InstanceId,
                    databaseHostId,
                    databaseInstanceNames,
                    modulesToInstall
                } = resource;
                const jobName = `Register instance(s) ${databaseInstanceNames} in ${ec2InstanceId}`;
                const { id: jobId } = await registerJob(accountId, credentialsId, region, {
                    type: JOBTYPE.REGISTER_RESOURCE,
                    status: JOBSTATUS.IN_PROGRESS,
                    resourceName: ec2InstanceId,
                    parentJobId: parentManageJobId,
                    name: jobName,
                    startTime: Date.now(),
                    description: jobName,
                    metadata: { ec2InstanceId, region, credentialsId, databaseInstanceNames }
                });
                await manageSqlInstance(
                    accountId,
                    credentialsId,
                    region,
                    ec2InstanceId,
                    databaseInstanceNames,
                    modulesToInstall,
                    parentManageJobId,
                    jobId,
                    databaseHostId
                );
            })
        )
    );
}

async function manageSqlInstances(accountId: string, resourcesToBeManaged: MultiInstanceManageMsSqlRequestBodyType[]) {
    logger.info('Register sql instances', { accountId, resourcesToBeManagedLength: resourcesToBeManaged.length });

    if (!resourcesToBeManaged?.length) {
        throw new Error('No sql instances to be registered');
    }
    const jobName = `Register SQL Server instances for account ${accountId}`;
    const { id: jobId } = await registerJob(accountId, '', '', {
        type: JOBTYPE.REGISTER_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: accountId,
        name: jobName,
        startTime: Date.now(),
        description: jobName
    });

    installAndManageSqlInstances(accountId, jobId, resourcesToBeManaged);

    return { jobId };
}

export { manageSqlInstances };
