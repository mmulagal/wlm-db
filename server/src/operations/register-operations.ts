import throat from 'throat';
import createError from 'http-errors';
import { JOBSTATUS, JOBTYPE, STORAGE_TYPE } from '@prisma/client';
import { ConnectionStatus } from '@aws-sdk/client-ssm';
import { attempt, cloneDeep, compact, isEmpty, uniqBy } from 'lodash-es';
import {
    derivePropertiesFromARN,
    escapeBackslash,
    generateSqlResourceId,
    getArtifactsRegionBucketName,
    getEc2Hostname,
    getServerNameWithHostname,
    retryWithDelay,
    IS_DEMO_FLOW
} from '../utils/utils';
import { registerJob, updateJobDetails, updateParentJobStatus } from './database/job-operations';
import { DiscoverOracleInstanceType, SqlServerInstanceInfoType } from '../routes/types/discover.types';
import getLogger from '../utils/logger';
import {
    AWS_CLI_LINUX_RELATIVE_PATH,
    CloudProviders,
    DatabaseTypes,
    DEFAULT_INSTANCE_NAME,
    HttpErrorCodes,
    JQ_LINUX_RELATIVE_PATH,
    MAKE_LINUX_RELATIVE_PATH,
    POWERSHELL_7_RELATIVE_PATH,
    PREPARE_PSMODULES_RELATIVE_PATH,
    PSMODULES_RELATIVE_PATH,
    RESOURCE_PREPARE_JOB_TIMEOUT_MINUTES,
    RESOURCE_SOURCE,
    RESOURCESTYPE,
    SqlServerDeploymentModel,
    SSM_PARAM_PREFIX,
    SSM_PARAMETERS_BASE_PATH
} from '../utils/consts';
import { callSsmExecution, getEc2SqlParameters, getSSMConnectionStatus, ssmPutParameters } from './aws/ssm-operations';
import { describeInstance, paginateDescribeEbsVolumes } from '../lib/aws/ec2';
import { discoverOracleResources, getHostAndSqlServerInfo } from './discover-operations';
import {
    ACTIVE_DIRECTORY,
    CHECK_POWERSHELL7_AVAILABLE,
    CLUSTER_NETWORK_IP_INFO_PS1,
    FAILURE_INFO,
    FEATURE_PREPREQUISITES,
    GET_ACTIVE_DIRECTORY_DETAILS,
    GET_MISSING_RESOURCE_DETAILS,
    INSTALL_POWERSHELL_7,
    INSTALL_WF_POWERSHELL_PREREQS_PS1,
    IS_DATABASE_CREATE_POSSIBLE,
    IS_PS7_AVAILABLE,
    REQUIRED_PS_MODULES_FOR_MANAGEMENT,
    UNAVAILABLE_PS_MODULES
} from './workloads/mssql/discover-consts';
import { getPaginatedDatabaseInstances, getResources } from './database/database-operations';
import { createResource, deleteDatabaseInstance, deleteResource, upsertDatabaseInstance } from '../lib/database/db';
import { tagResources } from './aws/sqs-operations';
import { createAssessmentData, createAssessmentDataForOracle } from './demo-operations';
import { preSignedUrl } from '../lib/aws/s3';
import {
    DatabaseInstance,
    DatabaseInstanceRegistration,
    FSxCredsRegistration,
    OracleCredential,
    OracleInstanceRegistration,
    SqlCredential,
    SSMParameterObject
} from '../utils/common-types';
import { getInstanceDetailsByPrivateIp } from './aws/ec2-operations';
import { getParameter, deleteParameters } from '../lib/aws/ssm';
import { registerFsxOntapCredentials, listFsxOntapCredentials } from '../lib/cloud-manager/fsx-core';
import {
    MultiInstanceManageMsSqlRequestBodyType,
    MultiInstanceManageResponseBodyType,
    RegisterCredentialsResponseType,
    RegisterCredentialsType,
    SingleInstanceRegisterCredentialsRequestBodyType,
    SingleRegisterCredentialsResponseType
} from '../routes/types/register.types';
import { getAsyncLocalStorageResource, setAsyncLocalStorageResource } from '../utils/async-local-storage';
import { DEMO_REGISTER_RESPONSE } from '../utils/demo-utils/demoMockdata';
import {
    copyPowerShellModule,
    validateOntapConnectivity,
    validateSQLInstanceConnectivity
} from './workloads/mssql/ssm-script-utils';
import { updateLongRunningAuditGroup } from './cloud-manager/audit-operations';
import {
    OracleDeploymentTenacy,
    pythonRelativePaths,
    SSM_RUN_SHELL_SCRIPT_DOC,
    SSM_RUN_SHELL_SCRIPT_DOC_VERSION
} from './workloads/oracle/consts';
import {
    checkAndInstallRequiredOracleDependentModules,
    checkIfValidLinuxUser,
    checkRequiredOracleUserPermissions,
    initializeResultObject,
    installPythonOnLinuxHost,
    validateOracleInstanceConnectivity,
    validateOracleInstanceFsxConnectivity
} from './workloads/oracle/oracle-ssm-script-utils';
import { getOracleDatabaseMappedVolumes } from './workloads/oracle/oracle-operations';

const logger = getLogger();
const WINDOWS = 'windows';

const { getPreSignedUrl } = preSignedUrl;

const EXISTING_FSX_PARAMETERS = 'EXISTING_FSX_PARAMETERS';
const NEW_SSM_PARAMETERS = 'NEW_SSM_PARAMETERS';
const TEMP = '_temp';
const WINDOWS_LOCAL_USER_ACCESS_ERROR =
    'Authenticating with Windows local/domain credentials require enable CredSSP on the system for delegating credentials within domain computers. If this is blocked on the system with domain group policies, feature will not work.';
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
        name: `Installing PowerShell 7.5.0 on ${ec2InstanceId}`,
        description: `Installing PowerShell 7.5.0 on ${ec2InstanceId} for Workload Factory database operations.`,
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

        const parsedInstallResponse = JSON.parse(installResponse || '{}');

        if (parsedInstallResponse && FAILURE_INFO in parsedInstallResponse) {
            throw new Error(parsedInstallResponse[FAILURE_INFO]);
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
        errorMessage = parsedResponse && FAILURE_INFO in parsedResponse ? parsedResponse[FAILURE_INFO] : '';
    } catch (error: any) {
        logger.error(`Failed to install PowerShell 7.5.0 on ${ec2InstanceId}: ${error.message}`);
        jobStatus = error.message?.includes('PowerShell 7 is already installed') ? JOBSTATUS.WARNING : JOBSTATUS.FAILED;
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
        name: `Installing PowerShell modules on ${ec2InstanceId}`,
        description: `Installing PowerShell modules on ${ec2InstanceId} for Workload Factory database operations.`,
        parentJobId: hostJobId,
        startTime: Date.now()
    });

    let ssmPsModuleInstallResponse;
    let parsedResponse;
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
        parsedResponse = JSON.parse(ssmPsModuleInstallResponse || '{}');
        if (parsedResponse && FAILURE_INFO in parsedResponse) {
            errorMessage = parsedResponse[FAILURE_INFO];
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
    return parsedResponse;
}

async function powershellInstallations(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    hostJobId: string,
    modulesToInstall: string[]
) {
    logger.info('Powershell installations', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        hostJobId,
        modulesToInstall
    });
    const shouldInstallPowershell7 = modulesToInstall.includes('Powershell 7');
    const shouldInstallPowershellModules = modulesToInstall.some(module => module !== 'Powershell 7');
    const psModulesToInstall = modulesToInstall.filter(module => module !== 'Powershell 7');

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
    const clusterNodeDetails = await getInstanceDetailsByPrivateIp(credentialsId, region, compact(clusterIps), {
        useCache: true
    });

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
    const ebsVolumes = await paginateDescribeEbsVolumes(
        credentialsId,
        region,
        {
            Filters: [{ Name: 'attachment.instance-id', Values: [node1InstanceId] }]
        },
        undefined,
        { useCache: true }
    );
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

async function registerSqlInstance(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    databaseInstanceNames: string[],
    modulesToInstall: string[],
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
            describeInstance(credentialsId, region, { InstanceIds: [ec2InstanceId] }, { useCache: true }),
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
        resourceId =
            IS_DEMO_FLOW && databaseHostId ? databaseHostId : generateSqlResourceId(node1InstanceId, undefined);

        let isResourceTobeCreated = !(IS_DEMO_FLOW && databaseHostId);
        let alreadyManagedDatabaseInstances: DatabaseInstance[] = [];
        if (!IS_DEMO_FLOW || !databaseHostId) {
            const {
                items: [resourceDetails]
            } = await getResources({
                accountId,
                resourceId,
                credentialsId,
                region,
                includeDatabaseInstances: true
            });
            isResourceTobeCreated = !resourceDetails;
            if (resourceDetails && Array.isArray(resourceDetails.database_instances)) {
                alreadyManagedDatabaseInstances = resourceDetails.database_instances;
            }
        }

        // Filter SQL Server instances: not already managed, storage is FSXN, deployment is Standalone or FCI
        const eligibleSqlInstances = (sqlServerInstances || []).filter((sqlInst: any) => {
            const isAlreadyManaged = alreadyManagedDatabaseInstances.some(
                elem => elem.database_instance_name === sqlInst.sqlServerInstance
            );
            const isSupportedDeployment = sqlInst.sqlServerDeploymentType !== SqlServerDeploymentModel.SQL_AOAG_SHORT;
            return !isAlreadyManaged && isSupportedDeployment;
        });

        const fciInstanceDetails = await getPartnerNodeDetails(
            credentialsId,
            region,
            ec2InstanceId,
            eligibleSqlInstances
        );

        let powershellInstallationResponse: any;
        let modulesInstallationResponse: { availablePSModules: string | string[]; failureInfo: string | undefined };
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

        await Promise.all(
            databaseInstanceNames.map(
                throat(1, async dbInst => {
                    let instanceJobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
                    let instanceErrorMessage = '';
                    let partnerEc2InstanceId;
                    try {
                        let sqlInstanceInfo = sqlServerInstances?.find(
                            (sqlInst: { sqlServerInstance: string }) => sqlInst.sqlServerInstance === dbInst
                        );

                        // If the current node is not active for FCI, then serverGuid will be empty and check on the partner node is handled later.
                        if (
                            !sqlInstanceInfo?.sqlServerDeploymentType ||
                            (sqlInstanceInfo.sqlServerDeploymentType !== SqlServerDeploymentModel.SQL_FCI_SHORT &&
                                !sqlInstanceInfo.serverGuid)
                        ) {
                            throw new Error(
                                'SQL Server instance not found or the required details (e.g., server GUID, deployment type) are missing.'
                            );
                        }
                        // If the current node is not active for FCI, then storage will be empty and check on the partner node is handled later.
                        if (
                            !isEmpty(sqlInstanceInfo.storage) &&
                            !sqlInstanceInfo.storage?.some(storage => storage.type === STORAGE_TYPE.FSXN)
                        ) {
                            throw new Error('SQL Server instance is not hosted on FSx for NetApp.');
                        }

                        // If the SQL Server instance is part of an FCI, get the partner EC2 instance ID.
                        if (sqlInstanceInfo.sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
                            const fciInstance = fciInstanceDetails.find(
                                instance => instance.databaseInstanceName === dbInst
                            );
                            partnerEc2InstanceId = fciInstance?.partnerEc2InstanceId;

                            if (!fciInstance || !partnerEc2InstanceId) {
                                throw new Error('FCI instance details or partner EC2 instance ID is missing.');
                            }

                            // If the SQL Server instance is not found on the current node, check the partner node.
                            if (!sqlInstanceInfo.serverGuid) {
                                const partnerNodeDiscoverDetails = await getHostAndSqlServerInfo(
                                    accountId,
                                    credentialsId,
                                    region,
                                    undefined,
                                    undefined,
                                    [partnerEc2InstanceId]
                                );
                                sqlInstanceInfo = partnerNodeDiscoverDetails.items[0]?.sqlServerInstances?.find(
                                    (sqlInst: { sqlServerInstance: string }) => sqlInst.sqlServerInstance === dbInst
                                );

                                if (!sqlInstanceInfo?.serverGuid || !sqlInstanceInfo?.sqlServerDeploymentType) {
                                    throw new Error(
                                        'SQL Server instance not found on the partner node, required details are missing (e.g., server GUID, deployment type).'
                                    );
                                }
                                if (!sqlInstanceInfo.storage?.some(storage => storage.type === STORAGE_TYPE.FSXN)) {
                                    throw new Error('SQL Server instance is not hosted on FSx for NetApp.');
                                }
                            }

                            resourceId = generateSqlResourceId(node1InstanceId, partnerEc2InstanceId);
                            const {
                                items: [resourceDetails]
                            } = await getResources({
                                accountId,
                                resourceId,
                                credentialsId,
                                region,
                                includeDatabaseInstances: true
                            });
                            isResourceTobeCreated = !resourceDetails;
                            alreadyManagedDatabaseInstances = resourceDetails?.database_instances || [];
                        } else if (!sqlInstanceInfo.serverGuid) {
                            throw new Error('SQL Server server GUID is missing.');
                        }

                        if (
                            !sqlInstanceInfo ||
                            alreadyManagedDatabaseInstances.some(elem => elem.database_instance_name === dbInst)
                        ) {
                            const errorMsg = !sqlInstanceInfo
                                ? 'SQL Server instance not found.'
                                : 'Instance is already registered.';
                            throw new Error(errorMsg);
                        }

                        const {
                            windowsAuthentication,
                            sqlServerAuthentication,
                            windowsDomainUserAuthentication,
                            serverGuid,
                            storage
                        } = sqlInstanceInfo;
                        const storageInfo = storage?.find((elem: { type: string }) => elem.type === STORAGE_TYPE.FSXN);
                        const storageProtocols = storage
                            ?.filter((elem: { type: string }) => elem.type === STORAGE_TYPE.FSXN)
                            .map((elem: any) => elem.protocol);

                        // Combine all failure conditions for early exit
                        let failureReason: string | undefined;

                        if (!windowsAuthentication && !sqlServerAuthentication && !windowsDomainUserAuthentication) {
                            failureReason =
                                'Unable to authenticate with the SQL Server instance. Windows authentication or SQL Server authentication is required.';
                        } else if (
                            sqlInstanceInfo.sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT
                        ) {
                            failureReason = 'Always On availability group environments are not supported.';
                        } else if (
                            modulesInstallationResponse &&
                            modulesToInstall.includes('AWS.Tools.SimpleSystemsManagement') &&
                            !modulesInstallationResponse.availablePSModules.includes(
                                'AWS.Tools.SimpleSystemsManagement'
                            )
                        ) {
                            failureReason = modulesInstallationResponse.failureInfo;
                        }

                        if (failureReason) {
                            throw new Error(failureReason);
                        }
                        if (!storageInfo) {
                            throw new Error('Storage information is missing for the SQL Server instance.');
                        }

                        // It could be that fsx credentials are already registered with storage services. Check and create ssm parameters if not already created.
                        try {
                            await verifyAndAddFSxOntapCredentials(accountId, credentialsId, region, storageInfo.id);
                        } catch (error: any) {
                            throw new Error(`Error while verifying or adding FSx ONTAP credentials: ${error.message}`);
                        }

                        let partnerPowershellInstallationResponse;
                        let partnerModulesInstallationResponse;

                        if (sqlInstanceInfo.sqlServerDeploymentType === SqlServerDeploymentModel.SQL_FCI_SHORT) {
                            ({
                                powershellInstallationResponse: partnerPowershellInstallationResponse,
                                modulesInstallationResponse: partnerModulesInstallationResponse
                            } = await powershellInstallations(
                                accountId,
                                credentialsId,
                                region,
                                partnerEc2InstanceId!,
                                hostJobId,
                                modulesToInstall
                            ));

                            // Check if the partner EC2 instance has the required PowerShell module installed.
                            // If the module "AWS.Tools.SimpleSystemsManagement" is specified in the modulesToInstall list
                            // and is not available in the partnerModulesInstallationResponse, throw an error with the failure reason.
                            if (
                                partnerModulesInstallationResponse &&
                                modulesToInstall &&
                                modulesToInstall.includes('AWS.Tools.SimpleSystemsManagement') &&
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
                            if (adDetails && adDetails.includes(ACTIVE_DIRECTORY)) {
                                ({ domainName: activeDirectoryDomainName, ipAddresses: activeDirectoryIpAddresses } =
                                    JSON.parse(adDetails!)[ACTIVE_DIRECTORY]);
                            }
                            const ebsVolumesFiltered = await getEbsVolumeDetails(
                                credentialsId,
                                region,
                                node1InstanceId
                            );

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
                                    ...(partnerEc2InstanceId && { node2InstanceId: partnerEc2InstanceId }),
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

                        tagResources(
                            credentialsId,
                            region,
                            awsAccountId!,
                            accountId,
                            storageInfo.id,
                            node1InstanceId,
                            partnerEc2InstanceId
                        );

                        const dbInstanceName = IS_DEMO_FLOW
                            ? sqlInstanceInfo.sqlServerInstance !== 'MSSQLSERVER'
                                ? sqlInstanceInfo.sqlServerName + sqlInstanceInfo.sqlServerInstance
                                : sqlInstanceInfo.sqlServerInstance
                            : sqlInstanceInfo.sqlServerInstance;

                        await upsertDatabaseInstance(accountId, {
                            credentialsId,
                            resourceId,
                            region,
                            databaseInstanceId: serverGuid,
                            databaseInstanceName: dbInstanceName,
                            fsxnIds: storageInfo.id,
                            isDefault: sqlInstanceInfo.isDefaultInstance,
                            source: RESOURCE_SOURCE.DISCOVER,
                            sqlDeploymentType: sqlInstanceInfo.sqlServerDeploymentType,
                            fsxSvmId: { [storageInfo.id]: storageInfo.svmId },
                            storageProtocol: storageProtocols ? storageProtocols.join() : '',
                            databaseType: DatabaseTypes.MS_SQL_SERVER
                        });
                        if (IS_DEMO_FLOW) {
                            await createAssessmentData(
                                accountId,
                                credentialsId,
                                region,
                                resourceId,
                                serverGuid!,
                                dbInstanceName,
                                sqlInstanceInfo.sqlServerDeploymentType
                            );
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
                })
            )
        );
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
        const errorMessage = instanceManagementStatus
            .filter(elem => elem.status === JOBSTATUS.FAILED)
            .map(elem => `${elem.databaseInstanceName}: ${elem.errorMessage}`)
            .join(', ');
        const jobMetadata = {
            ec2InstanceId,
            databaseInstanceNames,
            modulesToInstall,
            instanceManagementStatus,
            resourceId
        };
        await updateParentJobStatus(accountId, hostJobId, false, errorMessage, jobMetadata);
    }
}

async function installAndRegisterDatabaseServerInstances(
    accountId: string,
    parentManageJobId: string,
    resourcesToBeManaged: MultiInstanceManageMsSqlRequestBodyType[],
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
) {
    logger.info(`Install and register ${databaseType} server instances`, {
        accountId,
        parentManageJobId,
        resourcesToBeManaged: resourcesToBeManaged.length,
        databaseType
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
                const dbOrInstance = databaseType === DatabaseTypes.ORACLE ? 'database' : 'instance';
                const jobName = `Register ${dbOrInstance}(s) ${databaseInstanceNames} in ${ec2InstanceId}`;
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

                if (databaseType === DatabaseTypes.MS_SQL_SERVER) {
                    await registerSqlInstance(
                        accountId,
                        credentialsId,
                        region,
                        ec2InstanceId,
                        databaseInstanceNames,
                        modulesToInstall ?? [],
                        parentManageJobId,
                        jobId,
                        databaseHostId
                    );
                } else if (databaseType === DatabaseTypes.ORACLE) {
                    await registerOracleInstance(
                        accountId,
                        credentialsId,
                        region,
                        ec2InstanceId,
                        databaseInstanceNames,
                        parentManageJobId,
                        jobId,
                        databaseHostId
                    );
                } else {
                    throw createError(HttpErrorCodes.VALIDATION_ERROR, `Unsupported database type: ${databaseType}`);
                }
            })
        )
    );

    await updateParentJobStatus(accountId, parentManageJobId);
}

async function manageSqlServerV2(accountId: string, itemsTobeManged: MultiInstanceManageMsSqlRequestBodyType[]) {
    logger.info('Manage SQL Server instances (v2):', {
        accountId,
        instancesToBeManagedLength: itemsTobeManged.length
    });

    const manageResponse: MultiInstanceManageResponseBodyType = [];
    let auditlogResponse = '';
    await Promise.all(
        itemsTobeManged.map(
            throat(3, async (item: MultiInstanceManageMsSqlRequestBodyType) => {
                try {
                    const {
                        credentialsId,
                        region,
                        ec2InstanceId,
                        databaseInstanceNames: databaseInstanceNameList,
                        databaseHostId
                    } = item;

                    /* SSM is a must for all remaining validations */
                    const ssmStatus = await getSSMConnectionStatus(credentialsId, region, ec2InstanceId);
                    if (ssmStatus.Status === ConnectionStatus.NOT_CONNECTED) {
                        throw createError(HttpErrorCodes.VALIDATION_ERROR, 'No SSM connectivity.');
                    }

                    const [ec2Details, discoverDetails, clusterNetworkIpDetails, adDetails, missingResourceDetails] =
                        await Promise.all([
                            describeInstance(
                                credentialsId,
                                region,
                                { InstanceIds: [ec2InstanceId] },
                                { useCache: true }
                            ),
                            getHostAndSqlServerInfo(accountId, credentialsId, region, undefined, undefined, [
                                ec2InstanceId
                            ]),
                            callSsmExecution(
                                credentialsId,
                                region,
                                CLUSTER_NETWORK_IP_INFO_PS1,
                                ec2InstanceId,
                                'Get cluster network info',
                                accountId
                            ),
                            callSsmExecution(
                                credentialsId,
                                region,
                                GET_ACTIVE_DIRECTORY_DETAILS,
                                ec2InstanceId,
                                'Get AD details',
                                accountId
                            ),
                            callSsmExecution(
                                credentialsId,
                                region,
                                GET_MISSING_RESOURCE_DETAILS,
                                ec2InstanceId,
                                'Get missing resources',
                                accountId
                            )
                        ]);

                    const node1InstanceId = ec2InstanceId;
                    let node2InstanceId: string | undefined;
                    const precheckErrorList: string[] = [];
                    const missingResourceJson = JSON.parse(missingResourceDetails!);

                    if (missingResourceJson[IS_PS7_AVAILABLE] === false) {
                        precheckErrorList.push(
                            'PowerShell 7 is required for managing the resource. Install it manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.4.'
                        );
                    }
                    if (missingResourceJson[UNAVAILABLE_PS_MODULES]) {
                        precheckErrorList.push(
                            `PowerShell modules ${missingResourceJson[UNAVAILABLE_PS_MODULES]} are required for managing the resource. Install them manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/developer/module/installing-a-powershell-module?view=powershell-7.4) or using the API "/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare".`
                        );
                    }

                    const { awsAccountId } =
                        derivePropertiesFromARN(
                            ec2Details?.Reservations?.[0]?.Instances?.[0]?.IamInstanceProfile?.Arn || ''
                        ) || {};

                    if (isEmpty(awsAccountId)) {
                        precheckErrorList.push('Failed to get AWS account ID.');
                    }

                    if (clusterNetworkIpDetails?.includes(FAILURE_INFO)) {
                        precheckErrorList.push('Failed to get network interface details.');
                    } else if (clusterNetworkIpDetails) {
                        const clusterNetworkIpDetailsJson: { clusterNetworkIps: string[] } =
                            JSON.parse(clusterNetworkIpDetails);
                        if (clusterNetworkIpDetailsJson.clusterNetworkIps.length > 1) {
                            // FCI/AOAG environment
                            const clusterNodeDetails = await getInstanceDetailsByPrivateIp(
                                credentialsId,
                                region,
                                clusterNetworkIpDetailsJson.clusterNetworkIps,
                                { useCache: true }
                            );
                            const temp = clusterNodeDetails?.find(elem => elem.ec2InstanceId !== node1InstanceId);
                            if (!isEmpty(temp)) {
                                if (!IS_DEMO_FLOW) {
                                    node2InstanceId = temp.ec2InstanceId;
                                }

                                const node2ssmStatus = await getSSMConnectionStatus(
                                    credentialsId,
                                    region,
                                    node2InstanceId!
                                );
                                if (node2ssmStatus.Status === ConnectionStatus.NOT_CONNECTED) {
                                    precheckErrorList.push(`No SSM connectivity on partner node ${node2InstanceId}.`);
                                } else {
                                    const node2missingResourceDetails = await callSsmExecution(
                                        credentialsId,
                                        region,
                                        GET_MISSING_RESOURCE_DETAILS,
                                        node2InstanceId!,
                                        'Get missing resources',
                                        accountId
                                    );

                                    const node2missingResourceJson = JSON.parse(node2missingResourceDetails!);

                                    if (node2missingResourceJson[IS_PS7_AVAILABLE] === false) {
                                        precheckErrorList.push(
                                            `PowerShell 7 is required for managing the resource on partner node ${node2InstanceId}. Install it manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.4.`
                                        );
                                    }
                                    if (node2missingResourceJson[UNAVAILABLE_PS_MODULES]) {
                                        precheckErrorList.push(
                                            `PowerShell modules ${node2missingResourceJson[UNAVAILABLE_PS_MODULES]} are required for managing the resource on partner node ${node2InstanceId}. Install them manually by referring to https://learn.microsoft.com/en-us/powershell/scripting/developer/module/installing-a-powershell-module?view=powershell-7.4) or using the API "/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare".`
                                        );
                                    }
                                    if (node2missingResourceJson[IS_DATABASE_CREATE_POSSIBLE] === false) {
                                        precheckErrorList.push(
                                            `Files required for database operations are not available on partner node ${node2InstanceId}. Install them using the API "/accounts/{accountId}/wlmdb/v1/mssql/credentials/{credentialsId}/regions/{region}/instances/{instanceId}/prepare".`
                                        );
                                    }
                                }
                            }
                        }
                    }

                    if (isEmpty(adDetails) || adDetails?.includes(FAILURE_INFO)) {
                        precheckErrorList.push('Failed to get Active Directory details.');
                    }

                    const { count, items } = discoverDetails;

                    if (count <= 0) {
                        precheckErrorList.push(
                            'Only existing instances in running state, have Microsoft Windows as host operating system, architecture is x86_64, and hosting SQL Server 2016 above can be registered.'
                        );
                    }

                    if (!isEmpty(precheckErrorList)) {
                        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, precheckErrorList.join('\n'));
                    }

                    const [{ sqlServerInstances } = {}] = items || [];
                    let resourceId;
                    let isResourceTobeCreated: boolean;
                    if (IS_DEMO_FLOW && databaseHostId) {
                        resourceId = databaseHostId;
                        isResourceTobeCreated = false;
                    } else {
                        // A resource ID is a hash generated using available EC2 instance IDs.
                        resourceId = generateSqlResourceId(node1InstanceId, node2InstanceId);
                        const {
                            items: [resourceDetails]
                        } = await getResources({
                            accountId,
                            resourceId,
                            credentialsId,
                            region
                        });

                        isResourceTobeCreated = !resourceDetails;
                    }
                    const alreadyManagedResult = await getPaginatedDatabaseInstances(accountId, {
                        credentialsId,
                        resourceId,
                        region
                    });
                    const alreadyManagedDatabaseInstances = Array.isArray(alreadyManagedResult)
                        ? alreadyManagedResult
                        : alreadyManagedResult.items;

                    const itemsStatus: {
                        databaseInstanceName: string;
                        databaseInstanceGuid?: string;
                        status: string;
                        errorMessage?: string;
                    }[] = [];
                    if (sqlServerInstances && sqlServerInstances.length > 0) {
                        auditlogResponse += `${sqlServerInstances[0].sqlServerName}\\${databaseInstanceNameList.join(
                            ','
                        )};`;
                    }

                    await Promise.all(
                        databaseInstanceNameList.map(async dbInst => {
                            const sqlInstanceInfo = sqlServerInstances?.find(
                                (sqlInst: { sqlServerInstance: string }) => sqlInst.sqlServerInstance === dbInst
                            );

                            if (alreadyManagedDatabaseInstances.some(elem => elem.database_instance_name === dbInst)) {
                                itemsStatus.push({
                                    databaseInstanceName: dbInst,
                                    databaseInstanceGuid: sqlInstanceInfo?.serverGuid,
                                    status: 'failed',
                                    errorMessage: 'Instance is already managed.'
                                });
                            } else if (isEmpty(sqlInstanceInfo)) {
                                itemsStatus.push({
                                    databaseInstanceName: dbInst,
                                    status: 'failed',
                                    errorMessage: 'SQL Server instance not found.'
                                });
                            } else {
                                try {
                                    const { windowsAuthentication, sqlServerAuthentication, serverGuid, storage } =
                                        sqlInstanceInfo;
                                    const storageInfo = storage?.find(
                                        (elem: { type: string }) => elem.type === STORAGE_TYPE.FSXN
                                    );
                                    const storageProtocols = storage
                                        ?.filter((elem: { type: string }) => elem.type === STORAGE_TYPE.FSXN)
                                        .map((elem: any) => elem.protocol);

                                    if (windowsAuthentication === false && sqlServerAuthentication === false) {
                                        throw Error(
                                            'Authentication to SQL Server instance is not possible. Check if the SQL Server service is running, stored credentials are valid, or windows authentication is enabled.'
                                        );
                                    }

                                    if (isEmpty(storageInfo)) {
                                        throw Error(
                                            'SQL Server instance is not hosted on storage of type FSx for NetApp.'
                                        );
                                    }

                                    if (
                                        sqlInstanceInfo.sqlServerDeploymentType ===
                                        SqlServerDeploymentModel.SQL_AOAG_SHORT
                                    ) {
                                        throw Error('Always On availability group environments are not supported.');
                                    }

                                    try {
                                        await verifyAndAddFSxOntapCredentials(
                                            accountId,
                                            credentialsId,
                                            region,
                                            storageInfo!.id
                                        );
                                    } catch (error: any) {
                                        // verifyAndAddFSxOntapCredentials() is used by both V1 and V2 versions
                                        // of the API.  The prefix 'Unable to manage' is alredy added by V2 API.
                                        // To avoid duplication of sentence, we remove the sentence, if present.
                                        const errorMessage = error?.message?.replace(
                                            'Unable to manage the instance. Reason: ',
                                            ''
                                        );
                                        throw Error(isEmpty(errorMessage) ? error : errorMessage);
                                    }

                                    if (isResourceTobeCreated) {
                                        const {
                                            domainName: activeDirectoryDomainName,
                                            ipAddresses: activeDirectoryIpAddresses
                                        } = JSON.parse(adDetails!)[ACTIVE_DIRECTORY];
                                        const ebsVolumes = await paginateDescribeEbsVolumes(
                                            credentialsId,
                                            region,
                                            {
                                                Filters: [
                                                    {
                                                        Name: 'attachment.instance-id',
                                                        Values: node2InstanceId
                                                            ? [node1InstanceId, node2InstanceId]
                                                            : [node1InstanceId]
                                                    }
                                                ]
                                            },
                                            undefined,
                                            { useCache: true }
                                        );
                                        const ebsVolumesFiltered = ebsVolumes?.map(volume => ({
                                            iops: volume.Iops,
                                            size: volume.Size,
                                            isRoot: volume.Attachments?.some(
                                                attachment =>
                                                    attachment.Device === '/dev/xvda' ||
                                                    attachment.Device === '/dev/sda1'
                                            ),
                                            volumeType: volume.VolumeType,
                                            volumeId: volume.VolumeId,
                                            throughput: volume.Throughput
                                        }));

                                        await createResource(accountId, {
                                            resourceId,
                                            credentialsId,
                                            storageType: STORAGE_TYPE.FSXN,
                                            resourceName: sqlInstanceInfo.sqlServerName,
                                            cloudProviderAccountId: awsAccountId!,
                                            cloudProviderName: CloudProviders.AWS,
                                            resourceType: RESOURCESTYPE.MSSQL,
                                            coRelationId: storageInfo!.id,
                                            region,
                                            metadata: {
                                                creationDate: Date.now(),
                                                node1InstanceId,
                                                node2InstanceId,
                                                sqlDeploymentType: sqlInstanceInfo.sqlServerDeploymentType,
                                                source: RESOURCE_SOURCE.DISCOVER,
                                                fsxSvmId: storageInfo!.svmId,
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

                                    tagResources(
                                        credentialsId,
                                        region,
                                        awsAccountId!,
                                        accountId,
                                        storageInfo!.id,
                                        node1InstanceId,
                                        node2InstanceId
                                    );

                                    let dbInstanceName;
                                    if (IS_DEMO_FLOW) {
                                        dbInstanceName =
                                            sqlInstanceInfo.sqlServerInstance !== 'MSSQLSERVER'
                                                ? sqlInstanceInfo.sqlServerName + sqlInstanceInfo.sqlServerInstance
                                                : sqlInstanceInfo.sqlServerInstance;
                                    } else {
                                        dbInstanceName = sqlInstanceInfo.sqlServerInstance;
                                    }

                                    await upsertDatabaseInstance(accountId, {
                                        credentialsId,
                                        resourceId,
                                        region,
                                        databaseInstanceId: serverGuid!,
                                        databaseInstanceName: dbInstanceName,
                                        fsxnIds: storageInfo!.id,
                                        isDefault: sqlInstanceInfo.isDefaultInstance,
                                        source: RESOURCE_SOURCE.DISCOVER,
                                        sqlDeploymentType: sqlInstanceInfo.sqlServerDeploymentType!,
                                        fsxSvmId: { [storageInfo!.id]: storageInfo!.svmId },
                                        storageProtocol: storageProtocols ? storageProtocols.join() : '',
                                        databaseType: DatabaseTypes.MS_SQL_SERVER
                                    });
                                    if (IS_DEMO_FLOW) {
                                        await createAssessmentData(
                                            accountId,
                                            credentialsId,
                                            region,
                                            resourceId,
                                            serverGuid!,
                                            dbInstanceName,
                                            sqlInstanceInfo.sqlServerDeploymentType
                                        );
                                    }

                                    itemsStatus.push({
                                        databaseInstanceName: dbInst,
                                        databaseInstanceGuid: serverGuid,
                                        status: 'success'
                                    });
                                } catch (error) {
                                    itemsStatus.push({
                                        databaseInstanceName: dbInst,
                                        status: 'failed',
                                        errorMessage: `${error}`
                                    });
                                }
                            }
                        })
                    );
                    manageResponse.push({ resourceId, instances: itemsStatus, credentialsId, region, ec2InstanceId });
                } catch (error: any) {
                    const err = `Unable to register instance '${item.ec2InstanceId}'. Reason: ${error.message}`;
                    manageResponse.push({
                        hostErrorMessage: err,
                        credentialsId: item.credentialsId,
                        region: item.region,
                        ec2InstanceId: item.ec2InstanceId,
                        instances: item.databaseInstanceNames.map(name => ({ databaseInstanceName: name }))
                    });
                }
            })
        )
    );
    updateLongRunningAuditGroup(undefined, undefined, auditlogResponse);

    return { hosts: manageResponse };
}

async function registerDatabaseServerInstances(
    accountId: string,
    resourcesToBeManaged: MultiInstanceManageMsSqlRequestBodyType[],
    databaseType: DatabaseTypes = DatabaseTypes.MS_SQL_SERVER
) {
    logger.info(`Register ${databaseType} server instances`, {
        accountId,
        resourcesToBeManagedLength: resourcesToBeManaged.length
    });

    const dbOrInstances = databaseType === DatabaseTypes.ORACLE ? 'databases' : 'instances';
    if (!resourcesToBeManaged?.length) {
        throw new Error(`No ${databaseType} server ${dbOrInstances} to be registered`);
    }
    const jobName = `Register ${databaseType} server ${dbOrInstances} for account ${accountId}`;
    const { id: jobId } = await registerJob(accountId, '', '', {
        type: JOBTYPE.REGISTER_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: accountId,
        name: jobName,
        startTime: Date.now(),
        description: jobName
    });

    installAndRegisterDatabaseServerInstances(accountId, jobId, resourcesToBeManaged, databaseType);

    return { jobId };
}

async function registerOracleInstancesData(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    alreadyRegisteredDatabaseInstances: any[],
    oracleInstanceConfig: any
) {
    let instanceManagementStatus: {
        databaseInstanceName: string;
        databaseInstanceGuid?: string;
        status: string;
        errorMessage?: string;
    } = {
        databaseInstanceName: '',
        status: ''
    };

    const { resourceId, dbInst, oracleServerInstances, node1InstanceId, hostJobId, awsAccountId } =
        oracleInstanceConfig;

    let instanceJobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let instanceErrorMessage = '';

    const { storageInfo, oracleInstanceInfo, storageProtocols } = extractOracleStorageInfo(
        oracleServerInstances || [],
        dbInst
    );

    if (!oracleInstanceInfo || !oracleInstanceInfo.instanceId || !oracleInstanceInfo.instanceType) {
        throw new Error('Oracle Server instance not found or required details are missing.');
    }

    if (alreadyRegisteredDatabaseInstances.some(elem => elem.database_instance_name === dbInst)) {
        const errorMsg = 'Instance is already registered.';
        throw new Error(errorMsg);
    }

    try {
        // ToDo: Add oracle server auth field here
        const { instanceId } = oracleInstanceInfo;

        // Combine all failure conditions for early exit
        let failureReason: string | undefined;
        const oracleServerAuthentication = true;
        if (!oracleServerAuthentication) {
            failureReason =
                'Unable to authenticate with the Oracle Server instance. Oracle Server authentication is required.';
        } else if (!storageInfo) {
            failureReason = 'Oracle Server instance is not hosted on FSx for NetApp.';
        }

        if (failureReason) {
            throw new Error(failureReason);
        }

        if (storageInfo) {
            // It could be that fsx credentials are already registered with storage services. Check and create ssm parameters if not already created.
            try {
                await verifyAndAddFSxOntapCredentials(accountId, credentialsId, region, storageInfo.id);
            } catch (error: any) {
                throw new Error(`Error while verifying or adding FSx ONTAP credentials: ${error.message}`);
            }

            tagResources(credentialsId, region, awsAccountId!, accountId, storageInfo.id, node1InstanceId);

            const { instanceName: databaseInstanceName, instanceType: oracleDeploymentType } = oracleInstanceInfo;

            await upsertDatabaseInstance(accountId, {
                credentialsId,
                resourceId,
                region,
                databaseInstanceId: instanceId,
                databaseInstanceName,
                fsxnIds: storageInfo.id,
                isDefault: false, // Oracle instances do not have a default instance concept
                source: RESOURCE_SOURCE.DISCOVER,
                sqlDeploymentType: 'Standalone',
                fsxSvmId: { [storageInfo.id]: storageInfo.svmId },
                storageProtocol: storageProtocols ? storageProtocols.join() : '',
                databaseType: DatabaseTypes.ORACLE,
                metaData: {
                    oracleDeploymentType: oracleDeploymentType as OracleDeploymentTenacy
                }
            });

            instanceManagementStatus = {
                databaseInstanceName: dbInst,
                databaseInstanceGuid: instanceId,
                status: JOBSTATUS.COMPLETED
            };

            instanceJobStatus = JOBSTATUS.COMPLETED;
            // detect mapped vols for registered oracle instance
            if (instanceJobStatus === JOBSTATUS.COMPLETED && !IS_DEMO_FLOW) {
                try {
                    getOracleDatabaseMappedVolumes(accountId, credentialsId, region, resourceId, instanceId);
                } catch (error) {
                    logger.error('Error while detecting mapped volumes for Oracle instance', {
                        accountId,
                        credentialsId,
                        region,
                        resourceId,
                        instanceId,
                        error: (error as Error).message
                    });
                }
            }

            if (IS_DEMO_FLOW) {
                await createAssessmentDataForOracle(
                    accountId,
                    credentialsId,
                    region,
                    resourceId,
                    instanceId,
                    storageInfo.id,
                    storageProtocols ? storageProtocols.join() : ''
                );
            }
        }
    } catch (error: any) {
        logger.error('Error while registering Oracle instance', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            dbInst,
            error: error.message
        });
        instanceManagementStatus = {
            databaseInstanceName: dbInst,
            status: JOBSTATUS.FAILED,
            errorMessage: `${error}`
        };
        instanceJobStatus = JOBSTATUS.FAILED;
        instanceErrorMessage = `${error}`;
    } finally {
        await registerJob(accountId, credentialsId, region, {
            type: JOBTYPE.REGISTER_RESOURCE,
            status: instanceJobStatus,
            resourceName: accountId,
            parentJobId: hostJobId,
            name: `Register database ${dbInst}`,
            startTime: Date.now(),
            description: `Register database ${dbInst}`,
            error: instanceErrorMessage,
            endTime: Date.now()
        });
    }

    return instanceManagementStatus;
}

async function registerOracleInstance(
    accountId: string,
    credentialsId: string,
    region: string,
    ec2InstanceId: string,
    databaseInstanceNames: string[],
    parentManageJobId: string,
    hostJobId: string,
    databaseHostId?: string
) {
    logger.info('Register Oracle instance', {
        accountId,
        credentialsId,
        region,
        ec2InstanceId,
        databaseInstanceNames,
        parentManageJobId,
        hostJobId,
        databaseHostId
    });

    let jobStatus: JOBSTATUS = JOBSTATUS.IN_PROGRESS;
    let instanceManagementStatus: {
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

        const [ec2Details, discoverDetails] = await Promise.all([
            describeInstance(credentialsId, region, { InstanceIds: [ec2InstanceId] }, { useCache: true }),
            discoverOracleResources(accountId, credentialsId, region, undefined, undefined, [ec2InstanceId])
        ]);

        const node1InstanceId = ec2InstanceId;
        const { awsAccountId } =
            derivePropertiesFromARN(ec2Details?.Reservations?.[0]?.Instances?.[0]?.IamInstanceProfile?.Arn || '') || {};

        const [{ Tags: ec2InstanceTags, PrivateDnsName: ec2PrivateDnsName }] =
            ec2Details?.Reservations?.[0]?.Instances || [];

        const ec2HostName = ec2PrivateDnsName || getEc2Hostname(DatabaseTypes.ORACLE, ec2InstanceTags);

        const [{ databaseInstanceDetails: oracleServerInstances } = {}] = discoverDetails.items || [];
        resourceId =
            IS_DEMO_FLOW && databaseHostId ? databaseHostId : generateSqlResourceId(node1InstanceId, undefined);

        let isResourceToBeCreated = !(IS_DEMO_FLOW && databaseHostId);
        let alreadyRegisteredDatabaseInstances: DatabaseInstance[] = [];

        if (!IS_DEMO_FLOW || !databaseHostId) {
            const {
                items: [resourceDetails]
            } = await getResources({
                accountId,
                resourceId,
                credentialsId,
                region,
                includeDatabaseInstances: true,
                resourceType: [RESOURCESTYPE.ORACLE]
            });
            isResourceToBeCreated = !resourceDetails;
            if (resourceDetails && Array.isArray(resourceDetails.database_instances)) {
                alreadyRegisteredDatabaseInstances = resourceDetails.database_instances;
            }
        }

        await installPythonModules(accountId, region, credentialsId, ec2InstanceId, hostJobId);

        if (isResourceToBeCreated) {
            const { storageInfo, oracleInstanceInfo, storageProtocols } = extractOracleStorageInfo(
                oracleServerInstances || [],
                databaseInstanceNames[0]
            );
            await createResource(accountId, {
                resourceId,
                credentialsId,
                storageType: STORAGE_TYPE.FSXN,
                resourceName: ec2HostName,
                cloudProviderAccountId: awsAccountId!,
                cloudProviderName: CloudProviders.AWS,
                resourceType: RESOURCESTYPE.ORACLE,
                coRelationId: storageInfo?.id,
                region,
                metadata: {
                    creationDate: Date.now(),
                    node1InstanceId,
                    oracleDeploymentType: oracleInstanceInfo?.instanceType,
                    source: RESOURCE_SOURCE.DISCOVER,
                    fsxSvmId: storageInfo?.svmId,
                    storageProtocol: storageProtocols ? storageProtocols.join() : ''
                }
            });
        }

        instanceManagementStatus = await Promise.all(
            databaseInstanceNames.map(
                throat(1, async dbInst => {
                    const oracleInstanceConfig = {
                        resourceId,
                        dbInst,
                        oracleServerInstances,
                        node1InstanceId,
                        hostJobId,
                        awsAccountId,
                        ec2HostName
                    };
                    return registerOracleInstancesData(
                        accountId,
                        credentialsId,
                        region,
                        ec2InstanceId,
                        alreadyRegisteredDatabaseInstances,
                        oracleInstanceConfig
                    );
                })
            )
        );
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
        logger.error('Error while registering Oracle instances', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            databaseInstanceNames,
            error: error.message
        });
    } finally {
        const errorMessage = instanceManagementStatus
            .filter(elem => elem.status === JOBSTATUS.FAILED)
            .map(elem => `${elem.databaseInstanceName}: ${elem.errorMessage}`)
            .join(', ');
        const jobMetadata = {
            ec2InstanceId,
            databaseInstanceNames,
            instanceManagementStatus,
            resourceId
        };
        await updateParentJobStatus(accountId, hostJobId, false, errorMessage, jobMetadata);
    }
}

function extractOracleStorageInfo(oracleServerInstances: DiscoverOracleInstanceType[], databaseInstanceName: string) {
    logger.debug('Extract Oracle storage info', { databaseInstanceName });

    const oracleInstanceInfo = oracleServerInstances?.find(
        (oracleInst: { instanceName: string }) => oracleInst.instanceName === databaseInstanceName
    );
    const { storage } = oracleInstanceInfo || {};
    const storageInfo = storage?.find((elem: { type: string }) => elem.type === STORAGE_TYPE.FSXN);
    const storageProtocols = [
        ...new Set(
            compact(
                storage
                    ?.filter((elem: { type: string }) => elem.type === STORAGE_TYPE.FSXN)
                    .flatMap((elem: any) =>
                        Array.isArray(elem.mountDetails)
                            ? elem.mountDetails.map((mountDetail: any) => mountDetail.protocol)
                            : []
                    )
            )
        )
    ];
    return { storageInfo, oracleInstanceInfo, storageProtocols };
}

async function installPythonModules(
    accountId: string,
    region: string,
    credentialsId: string,
    instanceId: string,
    parentJobId: string
) {
    logger.info('Install Python modules', { accountId, region, credentialsId, instanceId });

    const { id: childJobId } = await registerJob(accountId, credentialsId, region, {
        type: JOBTYPE.REGISTER_RESOURCE,
        status: JOBSTATUS.IN_PROGRESS,
        resourceName: accountId,
        parentJobId,
        name: `Check and install python on instance ${instanceId}`,
        startTime: Date.now(),
        description: `Check and install python on instance ${instanceId}`
    });
    let errorMessage = '';
    let status = '';

    const bucketname = getArtifactsRegionBucketName(region);
    const pythonSignedUrls = await Promise.all(
        pythonRelativePaths.map(relativePath => getPreSignedUrl(region, bucketname, relativePath))
    );

    try {
        let parsedResponse;
        const ssmresponse = await callSsmExecution(
            credentialsId,
            region,
            [installPythonOnLinuxHost(pythonSignedUrls)],
            instanceId,
            'Install python on linux host',
            accountId,
            undefined,
            undefined,
            undefined,
            SSM_RUN_SHELL_SCRIPT_DOC,
            SSM_RUN_SHELL_SCRIPT_DOC_VERSION
        );

        const cleanResponse = ssmresponse?.replaceAll('\r\n', '');
        parsedResponse = attempt(JSON.parse, cleanResponse);

        parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;

        if (!parsedResponse) {
            throw new Error(`Failed to validate credentials. Reason: ${cleanResponse}`);
        }

        const isSuccessfulInstallation = parsedResponse?.installationSuccessful;

        if (isSuccessfulInstallation !== 'true') {
            throw new Error('Failed to install Python.');
        }
        status = JOBSTATUS.COMPLETED;
    } catch (error: any) {
        logger.error('Error while installing Python modules', {
            accountId,
            region,
            credentialsId,
            instanceId,
            error: error.message
        });
        errorMessage = error.message;
        status = JOBSTATUS.FAILED;
    } finally {
        await updateJobDetails(accountId, childJobId, {
            status,
            endTime: Date.now(),
            ...(errorMessage && { error: errorMessage })
        });
    }
}

function getErrorMessage(detectResponse: Record<string, string[]>[]) {
    logger.debug('Get detect resource error message', { detectResponse });

    let errorMessage = '';
    detectResponse.forEach(item => {
        if (item.hasOwnProperty('requiredModuleError') && item.requiredModuleError) {
            errorMessage += `requiredModuleError: ${item.requiredModuleError}, `;
        }
        if (item.hasOwnProperty('sqlServerError') && item.sqlServerError) {
            errorMessage += `sqlServerError: ${item.sqlServerError}, `;
        }
        if (item.hasOwnProperty('fsxnError') && item.fsxnError) {
            errorMessage += `fsxnError: ${item.fsxnError}`;
        }
    });
    errorMessage = errorMessage?.replace(', ', '');
    return errorMessage;
}

function prepareParametersToStore(instanceIds: string[], credentials: RegisterCredentialsType[]) {
    logger.debug('prepare parameters to store', { instanceIds });

    return credentials.reduce((acc: SSMParameterObject[], { resourceId, resourceType, username, password }) => {
        if (resourceType === RESOURCESTYPE.MSSQL) {
            const sqlItem = acc.find(el => el.value.sql);

            if (sqlItem && Array.isArray(sqlItem.value.sql)) {
                sqlItem.value.sql.push({
                    sqlinstancename: resourceId,
                    username,
                    password
                });
            } else {
                instanceIds.forEach(instanceId => {
                    const instanceObject = acc.find(el => el.path === `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`);
                    if (instanceObject) {
                        instanceObject.value.sql = [
                            {
                                sqlinstancename: resourceId,
                                username,
                                password
                            }
                        ];
                    } else {
                        acc.push({
                            path: `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`,
                            value: {
                                sql: [
                                    {
                                        sqlinstancename: resourceId,
                                        username,
                                        password
                                    }
                                ]
                            }
                        });
                    }
                });
            }
        } else if (resourceType === RESOURCESTYPE.FSX) {
            acc.push({
                path: `${SSM_PARAMETERS_BASE_PATH}/${resourceId}`,
                value: {
                    fsx: {
                        username,
                        password
                    }
                }
            });
        } else if (resourceType === RESOURCESTYPE.WINDOWS_USER) {
            const windowsUserItem = acc.find(el => el.value.domain);

            if (windowsUserItem && Array.isArray(windowsUserItem.value.domain)) {
                windowsUserItem.value.domain.push({
                    sqlinstancename: resourceId,
                    username: escapeBackslash(username),
                    password
                });
            } else {
                instanceIds.forEach(instanceId => {
                    const instanceObject = acc.find(el => el.path === `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`);
                    if (instanceObject) {
                        instanceObject.value.domain = [
                            {
                                sqlinstancename: resourceId,
                                username: escapeBackslash(username),
                                password
                            }
                        ];
                    } else {
                        acc.push({
                            path: `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`,
                            value: {
                                domain: [
                                    {
                                        sqlinstancename: resourceId,
                                        username: escapeBackslash(username),
                                        password
                                    }
                                ]
                            }
                        });
                    }
                });
            }
        } else if (resourceType === RESOURCESTYPE.ORACLE) {
            const oracleItem = acc.find(el => el.value.oracle);

            if (oracleItem && Array.isArray(oracleItem.value.oracle)) {
                oracleItem.value.oracle.push({
                    oracleinstancename: resourceId,
                    username,
                    password
                });
            } else {
                instanceIds.forEach(instanceId => {
                    const instanceObject = acc.find(el => el.path === `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`);
                    if (instanceObject) {
                        instanceObject.value.oracle = [
                            {
                                oracleinstancename: resourceId,
                                username,
                                password
                            }
                        ];
                    } else {
                        acc.push({
                            path: `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`,
                            value: {
                                oracle: [
                                    {
                                        oracleinstancename: resourceId,
                                        username,
                                        password
                                    }
                                ]
                            }
                        });
                    }
                });
            }
        } else if (resourceType === RESOURCESTYPE.ORACLE_ASM) {
            const oracleAsmItem = acc.find(el => el.value.asm);

            if (oracleAsmItem && Array.isArray(oracleAsmItem.value.asm)) {
                oracleAsmItem.value.asm.push({
                    oracleinstancename: resourceId,
                    username,
                    password
                });
            } else {
                instanceIds.forEach(instanceId => {
                    const instanceObject = acc.find(el => el.path === `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`);
                    if (instanceObject) {
                        instanceObject.value.asm = [
                            {
                                oracleinstancename: resourceId,
                                username,
                                password
                            }
                        ];
                    } else {
                        acc.push({
                            path: `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`,
                            value: {
                                asm: [
                                    {
                                        oracleinstancename: resourceId,
                                        username,
                                        password
                                    }
                                ]
                            }
                        });
                    }
                });
            }
        }
        return acc;
    }, []);
}

async function registerResourceCredentials(
    accountId: string,
    credentialsTobeValidated: SingleInstanceRegisterCredentialsRequestBodyType[]
) {
    logger.info('Register resource credentials', {
        accountId,
        credentialsTobeValidatedLength: credentialsTobeValidated.length
    });

    if (!credentialsTobeValidated?.length) {
        throw new Error('No credentials to be registered.');
    }

    // Remove duplicates based on ec2InstanceId
    credentialsTobeValidated = uniqBy(credentialsTobeValidated, 'ec2InstanceId');

    const response: RegisterCredentialsResponseType = {
        items: []
    };

    await Promise.all(
        credentialsTobeValidated.map(
            throat(3, async resource => {
                const { credentialsId, region, ec2InstanceId, credentials, checkManageReadiness } = resource;
                const registerResponse = await validateAndStoreDiscoveredParameters(
                    accountId,
                    credentialsId,
                    region,
                    ec2InstanceId,
                    credentials,
                    undefined,
                    checkManageReadiness
                );

                response.items.push({
                    ec2InstanceId,
                    credentialsId,
                    region,
                    registerDetails: Array.isArray(registerResponse) ? registerResponse : [registerResponse]
                });
            })
        )
    );

    return response;
}

async function validateAndStoreDiscoveredParameters(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    credentials: RegisterCredentialsType[],
    clusterNodesIpAddress?: string[],
    checkManageReadiness: boolean = false,
    singleInstanceRegistration: boolean = false
) {
    logger.info('Validate and store SSM parameters', {
        accountId,
        credentialsId,
        region,
        instanceId,
        checkManageReadiness
    });

    if (IS_DEMO_FLOW) {
        const response: SingleRegisterCredentialsResponseType[] = [];

        const processCredential = (cred: RegisterCredentialsType) => {
            if (cred.resourceType === RESOURCESTYPE.FSX) {
                if (!singleInstanceRegistration) {
                    response.push({
                        resourceId: cred.resourceId,
                        resourceType: cred.resourceType,
                        fsxnError: ''
                    });
                }
                return;
            }

            const baseResponse =
                cred.resourceType === RESOURCESTYPE.ORACLE
                    ? {
                          manageReadiness: {
                              oracle: {
                                  missingModules: [],
                                  missingPermissions: []
                              }
                          }
                      }
                    : { ...DEMO_REGISTER_RESPONSE };

            if (singleInstanceRegistration) {
                response.push(baseResponse);
            } else {
                response.push({
                    ...baseResponse,
                    resourceId: cred.resourceId,
                    resourceType: cred.resourceType
                });
            }
        };

        credentials.forEach(processCredential);
        return response;
    }

    try {
        if (!accountId || !credentialsId || !region || !instanceId) {
            logger.error('Invalid input parameters', { accountId, credentialsId, region, instanceId });
            throw new Error('Invalid input parameters');
        }

        credentials = uniqBy(credentials, 'resourceId');
        const fsxCredentials = credentials.find(cred => cred.resourceType === RESOURCESTYPE.FSX);
        const sqlCredentials = credentials.filter(cred => cred.resourceType === RESOURCESTYPE.MSSQL);
        const oracleCredentials = credentials.filter(cred => cred.resourceType === RESOURCESTYPE.ORACLE);
        const windowsUserCredentials = credentials.filter(cred => cred.resourceType === RESOURCESTYPE.WINDOWS_USER);
        const oracleAsmCredentials = credentials.filter(cred => cred.resourceType === RESOURCESTYPE.ORACLE_ASM);
        if (
            isEmpty(fsxCredentials) &&
            isEmpty(sqlCredentials) &&
            isEmpty(windowsUserCredentials) &&
            isEmpty(oracleCredentials) &&
            isEmpty(oracleAsmCredentials)
        ) {
            throw new Error('Credentials cannot be empty');
        }

        let instanceIds = [instanceId];
        if (clusterNodesIpAddress && !isEmpty(clusterNodesIpAddress)) {
            try {
                const clusterNodeDetails =
                    (await getInstanceDetailsByPrivateIp(credentialsId, region, clusterNodesIpAddress, {
                        useCache: true
                    })) || [];
                instanceIds = clusterNodeDetails.map(e => e.ec2InstanceId);
            } catch (error) {
                logger.error('Error while generating resource id for SSM parameter: ', error);
            }
        }

        const detectResponse = await validateCredentials(
            accountId,
            credentialsId,
            region,
            instanceId,
            fsxCredentials,
            sqlCredentials,
            windowsUserCredentials,
            oracleCredentials,
            oracleAsmCredentials,
            instanceIds,
            checkManageReadiness
        );

        // resource-credentials support until UI makes changes to use register-credentials API across

        if (singleInstanceRegistration) {
            const errorMessage = getErrorMessage(detectResponse);
            if (errorMessage) {
                logger.error('Failed to validate credentials', errorMessage);
                throw createError(HttpErrorCodes.VALIDATION_ERROR, errorMessage);
            }

            const instanceDetails = detectResponse.find(item => item.resourceId === credentials[0]?.resourceId);
            if (instanceDetails) {
                return {
                    databaseCount: instanceDetails.databaseCount,
                    databaseServerEdition: instanceDetails.sqlServerEdition,
                    manageReadiness: instanceDetails.manageReadiness,
                    databaseServerError: instanceDetails.sqlServerError,
                    requiredModuleError: instanceDetails.requiredModuleError,
                    fsxnError: instanceDetails.fsxnError
                } as SingleRegisterCredentialsResponseType;
            }
        }

        return detectResponse;
    } catch (error: any) {
        logger.error('Failed to validate credentials', error);
        throw createError(error?.statusCode || HttpErrorCodes.BAD_REQUEST, error.message);
    }
}

async function rewriteOrDeleteSSMParameter(
    credentialsId: string,
    region: string,
    instanceIds: string[],
    paramsToDelete: string[],
    instancesToBeDeleted: string[],
    fsxCredentials: RegisterCredentialsType,
    sqlCredentials: RegisterCredentialsType[],
    windowsUserCredentials: RegisterCredentialsType[],
    allDatabaseCredentials: RegisterCredentialsType[] = [],
    allWindowsUserCredentials: RegisterCredentialsType[] = [],
    oracleAsmCredentials: RegisterCredentialsType[] = [],
    allOracleAsmCredentials: RegisterCredentialsType[] = []
) {
    logger.info('Calling rewriteOrDeleteSSMParameter', {
        credentialsId,
        region,
        instanceIds,
        paramsToDelete,
        instancesToBeDeleted,
        fsxCredentials,
        sqlCredentials,
        windowsUserCredentials,
        oracleAsmCredentials
    });
    if (
        (isEmpty(allWindowsUserCredentials) &&
            !isEmpty(sqlCredentials) &&
            sqlCredentials.length === instancesToBeDeleted.length) ||
        (isEmpty(allDatabaseCredentials) &&
            !isEmpty(windowsUserCredentials) &&
            windowsUserCredentials.length === instancesToBeDeleted.length) ||
        (isEmpty(allOracleAsmCredentials) &&
            !isEmpty(sqlCredentials) &&
            sqlCredentials.length === instancesToBeDeleted.length) ||
        (isEmpty(allDatabaseCredentials) &&
            !isEmpty(oracleAsmCredentials) &&
            oracleAsmCredentials.length === instancesToBeDeleted.length)
    ) {
        // Delete the parameter store all credentials are invalid
        instanceIds.forEach(instanceId => paramsToDelete.push(`${SSM_PARAM_PREFIX}${instanceId}`));
    }
    await deleteSSMParameter(credentialsId, region, paramsToDelete);
    // Rewrite parameter store after removing invalid credentials
    const latestFsxCredentials = fsxCredentials
        ? filterAndMapCredentials([fsxCredentials], [fsxCredentials], paramsToDelete)
        : [];
    const latestSqlCredentials = filterAndMapCredentials(allDatabaseCredentials, sqlCredentials, instancesToBeDeleted);
    const latestWindowsUserCredentials = filterAndMapCredentials(
        allWindowsUserCredentials,
        windowsUserCredentials,
        instancesToBeDeleted
    );
    const latestOracleAsmCredentials = filterAndMapCredentials(
        allOracleAsmCredentials,
        oracleAsmCredentials,
        instancesToBeDeleted
    );

    const creds = prepareParametersToStore(instanceIds, [
        ...latestFsxCredentials,
        ...latestSqlCredentials,
        ...latestWindowsUserCredentials,
        ...latestOracleAsmCredentials
    ]);

    if (isEmpty(latestFsxCredentials)) {
        const existingFsxCreds: SSMParameterObject = await getAsyncLocalStorageResource(EXISTING_FSX_PARAMETERS);
        if (existingFsxCreds?.path?.includes(fsxCredentials?.resourceId)) {
            if (existingFsxCreds.value) {
                creds.push(existingFsxCreds);
            } else {
                logger.error('Existing FSx credentials are invalid or missing', { existingFsxCreds });
            }
        }
    }

    if (!isEmpty(creds)) {
        await ssmPutParameters(credentialsId, region, creds);
    }

    // This code is specific to the case where there are wrong creds already and even the validated credentials are wrong.
    const cleanedUpdatedParams = compact(await cleanUpdatedParams(credentialsId, region, instanceIds));
    if (!isEmpty(cleanedUpdatedParams)) {
        await ssmPutParameters(credentialsId, region, cleanedUpdatedParams);
    }
}

async function cleanUpdatedParams(
    credentialsId: string,
    region: string,
    instanceIds: string[]
): Promise<(SSMParameterObject | undefined)[]> {
    logger.info('Get existing SSM parameters', { credentialsId, region, instanceIds });

    return Promise.all(
        instanceIds.map(async instanceId => {
            const { domain, sql } = await getEc2SqlParameters(credentialsId, region, instanceId);
            domain?.forEach((item: SqlCredential) => {
                item.sqlinstancename = item.sqlinstancename.replace(TEMP, '');
            });
            sql?.forEach((item: SqlCredential) => {
                item.sqlinstancename = item.sqlinstancename.replace(TEMP, '');
            });

            if (isEmpty(domain) && isEmpty(sql)) {
                return;
            }

            return {
                path: `${SSM_PARAMETERS_BASE_PATH}/${instanceId}`,
                value: {
                    ...(!isEmpty(domain) && { domain }),
                    ...(!isEmpty(sql) && { sql })
                }
            } as SSMParameterObject;
        })
    );
}

function filterAndMapCredentials(
    allCredentials: RegisterCredentialsType[],
    userRequestedCredentials: RegisterCredentialsType[],
    instancesToBeDeleted: string[]
): RegisterCredentialsType[] {
    logger.debug('Filter and map credentials', {
        allCredentialsLength: allCredentials.length,
        userRequestedCredentialsLength: userRequestedCredentials.length
    });

    const userRequestedCredentialsMap = new Map<string, RegisterCredentialsType>();
    (userRequestedCredentials ?? []).forEach(e => {
        const cleanId = e.resourceId.replace(TEMP, '');
        if (!instancesToBeDeleted.includes(`${cleanId}${TEMP}`)) {
            userRequestedCredentialsMap.set(cleanId, {
                ...e,
                resourceId: cleanId
            });
        }
    });

    // Filter allCredentials, but if a matching sqlinstancename exists in userRequestedCredentials, use that instead
    let latestAllCredentials = allCredentials
        .filter(
            creds =>
                !(
                    instancesToBeDeleted.includes(creds.resourceId) ||
                    instancesToBeDeleted.find(r => r.includes('fs') && r.includes(creds.resourceId))
                )
        )
        .map(creds => ({ ...creds, resourceId: creds.resourceId.replace(TEMP, '') }));

    latestAllCredentials = uniqBy(latestAllCredentials, 'resourceId');
    return latestAllCredentials.map(creds => {
        const cleanId = creds.resourceId.replace(TEMP, '');
        if (userRequestedCredentialsMap.has(cleanId)) {
            return userRequestedCredentialsMap.get(cleanId)!;
        }

        return {
            ...creds,
            resourceId: cleanId
        };
    });
}

async function validateCredentials(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    fsxCredentials: RegisterCredentialsType | undefined,
    sqlCredentials: RegisterCredentialsType[],
    windowsUserCredentials: RegisterCredentialsType[],
    oracleCredentials: RegisterCredentialsType[],
    oracleAsmCredentials: RegisterCredentialsType[],
    instanceIds: string[],
    checkManageReadiness: boolean = false
) {
    logger.info('Validate credentials', {
        instanceId,
        fsxCredentials,
        sqlCredentials,
        instanceIds,
        windowsUserCredentials,
        oracleCredentials,
        oracleAsmCredentials,
        checkManageReadiness
    });

    const connectionStatus = await getSSMConnectionStatus(credentialsId, region, instanceId);

    // TODO: Revisit this logic, as it is not clear why we are trying to delete SSM parameters when we haven't set any.
    const ssmParameters = [`${SSM_PARAM_PREFIX}${fsxCredentials?.resourceId}`];
    instanceIds.forEach(instance => ssmParameters.push(`${SSM_PARAM_PREFIX}${instance}`));

    if (connectionStatus.Status !== ConnectionStatus.CONNECTED) {
        const errorMessage = `Unable to validate the credentials through SSM, for host ${instanceId}`;
        logger.error(errorMessage);

        await deleteSSMParameter(credentialsId, region, ssmParameters);
        throw createError(HttpErrorCodes.INTERNAL_SERVER_ERROR, errorMessage);
    }

    const newSqlCredentials = cloneDeep(sqlCredentials);
    const newWindowsUserCredentials = cloneDeep(windowsUserCredentials);
    const newOracleCredentials = cloneDeep(oracleCredentials);
    const newOracleAsmCredentials = cloneDeep(oracleAsmCredentials || []);
    const credentialsForValidation =
        (newSqlCredentials && newSqlCredentials.length) > 0 ? newSqlCredentials : newOracleCredentials;
    const { allDatabaseCredentials, allWindowsUserCredentials, allOracleAsmCredentials } =
        await verifyAndCreateCredentials(
            credentialsId,
            region,
            instanceId,
            fsxCredentials,
            credentialsForValidation,
            windowsUserCredentials,
            oracleAsmCredentials,
            instanceIds
        );

    try {
        let isLinuxHost = false;
        if (fsxCredentials) {
            const { Reservations = [] } = await describeInstance(credentialsId, region, {
                InstanceIds: [instanceId]
            });
            const { Platform } = Reservations[0]?.Instances?.[0] || {};

            // Platform Field:
            // This field is available for Windows instances and will have the value windows if the instance is running Windows.
            // For Linux-based instances, this field is null
            isLinuxHost = Platform?.toLowerCase() !== WINDOWS;
        }
        const isOracleInstance = newOracleCredentials.some(cred => cred.resourceType === RESOURCESTYPE.ORACLE);
        const isOracleAsmInstance = newOracleAsmCredentials.some(
            cred => cred.resourceType === RESOURCESTYPE.ORACLE_ASM
        );
        let response;
        if (isLinuxHost || isOracleInstance || isOracleAsmInstance) {
            response = await validateOracleCredentials(
                accountId,
                credentialsId,
                region,
                instanceId,
                fsxCredentials,
                newOracleCredentials,
                newOracleAsmCredentials,
                instanceIds,
                allDatabaseCredentials,
                allOracleAsmCredentials,
                checkManageReadiness
            );
        } else {
            response = await validateWindowsCredentials(
                accountId,
                credentialsId,
                region,
                instanceId,
                fsxCredentials,
                newSqlCredentials,
                newWindowsUserCredentials,
                instanceIds,
                checkManageReadiness,
                allDatabaseCredentials,
                allWindowsUserCredentials
            );
        }

        return response;
    } catch (error: any) {
        // delete the ssm parameters if its already created
        const paramsToDelete: string[] = [];
        const instancesToBeDeleted: string[] = [];

        if (fsxCredentials) {
            paramsToDelete.push(`${SSM_PARAM_PREFIX}${fsxCredentials.resourceId}`);
        }

        if (sqlCredentials.length || windowsUserCredentials.length) {
            instancesToBeDeleted.push(
                ...(sqlCredentials ?? []).map(e => e.resourceId),
                ...(windowsUserCredentials ?? []).map(e => e.resourceId)
            );
        }

        await rewriteOrDeleteSSMParameter(
            credentialsId,
            region,
            instanceIds,
            paramsToDelete,
            instancesToBeDeleted,
            fsxCredentials!,
            newSqlCredentials,
            windowsUserCredentials,
            allDatabaseCredentials,
            allWindowsUserCredentials
        );

        throw createError(
            HttpErrorCodes.INTERNAL_SERVER_ERROR,
            `Unable to validate the credentials . Reason: ${error?.message}.`
        );
    }
}

async function validateWindowsCredentials(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    fsxCredentials: RegisterCredentialsType | undefined,
    sqlCredentials: RegisterCredentialsType[],
    windowsUserCredentials: RegisterCredentialsType[],
    instanceIds: string[],
    checkManageReadiness: boolean = false,
    allDatabaseCredentials: RegisterCredentialsType[] = [],
    allWindowsUserCredentials: RegisterCredentialsType[] = []
) {
    logger.info('Validate Windows credentials', {
        accountId,
        credentialsId,
        region,
        instanceId,
        sqlCredentialsLength: sqlCredentials.length,
        windowsUserCredentialsLength: windowsUserCredentials.length,
        instanceIds,
        checkManageReadiness
    });

    let parsedResponse;
    let command = '$WarningPreference = "SilentlyContinue";';
    const newSqlCredentials = cloneDeep(sqlCredentials);

    if (fsxCredentials || sqlCredentials.length || windowsUserCredentials) {
        // Get signed url for aws_ssm.zip to install the ps modules
        const bucketname = getArtifactsRegionBucketName(region);
        const copyPSModuleS3SignedUrl = await getPreSignedUrl(region, bucketname, PSMODULES_RELATIVE_PATH);
        const moduleNames = `
  'AWS.Tools.SimpleSystemsManagement'
`;
        command += `${copyPowerShellModule(copyPSModuleS3SignedUrl, moduleNames)};\n`;
    }

    if (fsxCredentials) {
        command += `${validateOntapConnectivity([fsxCredentials.resourceId], region)};\n`;
    }

    if (sqlCredentials.length) {
        const resourcesWithSqlAuth = sqlCredentials.map(cred => cred.resourceId);
        command += `${validateSQLInstanceConnectivity(
            instanceId,
            resourcesWithSqlAuth,
            false,
            checkManageReadiness
        )};\n`;
    }

    if (!isEmpty(windowsUserCredentials)) {
        const resourcesWithWindowsAuth = windowsUserCredentials.map(cred => cred.resourceId);
        command += `${validateSQLInstanceConnectivity(
            instanceId,
            resourcesWithWindowsAuth,
            true,
            checkManageReadiness
        )};\n`;
    }

    command += '$responseObject | ConvertTo-Json -Compress';

    const ssmresponse = await callSsmExecution(
        credentialsId,
        region,
        [command],
        instanceId,
        'Validate credentials',
        undefined,
        false
    );

    const cleanResponse = ssmresponse?.replaceAll('\r\n', '');
    parsedResponse = attempt(JSON.parse, cleanResponse);

    parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;

    if (!parsedResponse) {
        throw new Error(`Failed to validate credentials. Reason: ${cleanResponse}`);
    }

    const response: Record<string, any>[] = [];
    const paramsToDelete: string[] = [];
    const instancesToBeDeleted: string[] = [];

    if (fsxCredentials) {
        parsedResponse.fsxResults.map(async (fsxResult: FSxCredsRegistration) => {
            if (fsxResult.ontapconnectivity === false && fsxResult.fsxId === fsxCredentials.resourceId) {
                response.push({
                    resourceId: fsxCredentials.resourceId,
                    resourceType: RESOURCESTYPE.FSX,
                    fsxnError: fsxResult.ontaperror
                });
                paramsToDelete.push(`${SSM_PARAM_PREFIX}${fsxCredentials.resourceId}`);
            } else if (fsxResult.ontapconnectivity === true && fsxResult.fsxId === fsxCredentials.resourceId) {
                response.push({
                    resourceId: fsxCredentials.resourceId,
                    resourceType: RESOURCESTYPE.FSX,
                    fsxnError: ''
                });
                await registerFsxOntapCredentials(
                    accountId,
                    credentialsId,
                    region,
                    fsxCredentials.resourceId,
                    fsxCredentials.password
                );
            }
        });
    }

    if (sqlCredentials.length || windowsUserCredentials.length) {
        parsedResponse.instances.forEach((instance: DatabaseInstanceRegistration) => {
            if (instance.sqlInstanceConnectivity === false) {
                instancesToBeDeleted.push(`${instance?.sqlInstanceName}${TEMP}`);
                if (instance?.sqlerror?.includes('Access is denied')) {
                    instance.sqlerror = WINDOWS_LOCAL_USER_ACCESS_ERROR;
                }
                response.push({ resourceId: instance.sqlInstanceName, databaseServerError: instance?.sqlerror });
            } else {
                const {
                    sqlPermissions = [],
                    availablePsModules = [],
                    sqlInstanceConnectivity,
                    sqlEdition,
                    noOfDatabases,
                    sqlInstanceName
                } = instance || {};

                const manageReadiness = checkManageReadiness
                    ? Object.fromEntries(
                          Object.entries(FEATURE_PREPREQUISITES).map(([key, value]) => [
                              key.toLowerCase(),
                              {
                                  missingSqlPermissions: value.SQL_PERMISSIONS.filter(x => !sqlPermissions.includes(x)),
                                  missingModules: value.MODULES.filter(x => !availablePsModules.includes(x))
                              }
                          ])
                      )
                    : undefined;

                response.push({
                    resourceId: sqlInstanceName,
                    resourceType: RESOURCESTYPE.MSSQL,
                    databaseServerEdition: sqlEdition,
                    databaseCount: noOfDatabases,
                    ...(checkManageReadiness && {
                        manageReadiness: { ...manageReadiness, missingSqlCmd: !sqlInstanceConnectivity }
                    })
                });
            }
        });
    }

    await rewriteOrDeleteSSMParameter(
        credentialsId,
        region,
        instanceIds,
        paramsToDelete,
        instancesToBeDeleted,
        fsxCredentials!,
        newSqlCredentials,
        windowsUserCredentials,
        allDatabaseCredentials,
        allWindowsUserCredentials
    );

    return response;
}

async function validateOracleCredentials(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    fsxCredentials: RegisterCredentialsType | undefined,
    oracleCredentials: RegisterCredentialsType[],
    oracleAsmCredentials: RegisterCredentialsType[] | undefined,
    instanceIds: string[],
    allDatabaseCredentials: RegisterCredentialsType[] = [],
    allOracleAsmCredentials: RegisterCredentialsType[] = [],
    checkManageReadiness: boolean = false
) {
    logger.info('Validate Oracle credentials', {
        accountId,
        credentialsId,
        region,
        instanceId,
        oracleCredentialsLength: oracleCredentials.length,
        oracleAsmCredentialsLength: oracleAsmCredentials?.length,
        checkManageReadiness,
        allDatabaseCredentialsLength: allDatabaseCredentials.length,
        allOracleAsmCredentialsLength: allOracleAsmCredentials.length,
        instanceIds
    });

    let command = '';
    let parsedResponse;

    const bucketname = getArtifactsRegionBucketName(region);
    const awsCliSignedUrl = await getPreSignedUrl(region, bucketname, AWS_CLI_LINUX_RELATIVE_PATH);
    const jqSignedUrl = await getPreSignedUrl(region, bucketname, JQ_LINUX_RELATIVE_PATH);
    const makeSignedUrl = await getPreSignedUrl(region, bucketname, MAKE_LINUX_RELATIVE_PATH);
    const signedUrls = [awsCliSignedUrl, jqSignedUrl, makeSignedUrl];

    command += `${initializeResultObject}\n`;
    if (checkManageReadiness) {
        command += `${checkAndInstallRequiredOracleDependentModules(signedUrls)}\n`;

        if (oracleCredentials.length) {
            command += oracleCredentials.reduce(
                (acc: string, { resourceId }) =>
                    `${acc}${checkRequiredOracleUserPermissions(instanceId, resourceId)}\n`,
                ''
            );
        }
    } else {
        command += 'isAwsCliInstalled=true\nisJqInstalled=true\n';
    }

    if (fsxCredentials) {
        command += `${validateOracleInstanceFsxConnectivity(fsxCredentials.resourceId, region)}\n`;
    }

    if (oracleCredentials.length) {
        command += oracleCredentials.reduce(
            (acc: string, { resourceId }) => `${acc}${validateOracleInstanceConnectivity(instanceId, resourceId)}\n`,
            ''
        );
    }

    if (oracleAsmCredentials?.length) {
        command += checkIfValidLinuxUser(instanceId);
    }

    command += 'echo $resultObject';

    const ssmresponse = await callSsmExecution(
        credentialsId,
        region,
        [command],
        instanceId,
        'Validate Oracle Credentials',
        accountId,
        undefined,
        undefined,
        undefined,
        SSM_RUN_SHELL_SCRIPT_DOC,
        SSM_RUN_SHELL_SCRIPT_DOC_VERSION
    );

    const cleanResponse = ssmresponse?.replaceAll('\r\n', '');
    parsedResponse = attempt(JSON.parse, cleanResponse);

    parsedResponse = parsedResponse instanceof Error ? undefined : parsedResponse;

    if (!parsedResponse) {
        throw new Error(`Failed to validate credentials. Reason: ${cleanResponse}`);
    }

    const response: Record<string, any>[] = [];
    const paramsToDelete: string[] = [];
    const instancesToBeDeleted: string[] = [];

    const instanceIdToMissingPermissionsMap = new Map<string, string[]>();
    const instanceIdToRemediationMissingPermissionsMap = new Map<string, string[]>();
    let missingModules: string[] = [];

    if (checkManageReadiness) {
        const { modulesInstallationResults, missingOracleUserPermissions } = parsedResponse;
        missingModules = parsedResponse?.missingModules || [];
        logger.debug('Modules installation results', {
            modulesInstallationResults,
            missingOracleUserPermissions,
            missingModules
        });

        if (missingOracleUserPermissions && missingOracleUserPermissions.length) {
            for (const permission of missingOracleUserPermissions) {
                const { instanceSid, missingPermissions, remediationMissingPermissions } = permission;
                instanceIdToMissingPermissionsMap.set(instanceSid, missingPermissions);
                instanceIdToRemediationMissingPermissionsMap.set(instanceSid, remediationMissingPermissions);
            }
        }

        if (modulesInstallationResults && modulesInstallationResults.length) {
            let errString = '';
            for (const moduleResult of modulesInstallationResults) {
                if (moduleResult?.error) {
                    errString += moduleResult.error;
                }
            }
            if (errString) {
                throw createError(
                    HttpErrorCodes.VALIDATION_ERROR,
                    `Failed to validate Oracle credentials. Reason: ${errString}`
                );
            }
        }
    }

    if (fsxCredentials) {
        parsedResponse.fsxResults.map(async (fsxResult: FSxCredsRegistration) => {
            if (fsxResult.ontapconnectivity === false && fsxResult.fsxId === fsxCredentials.resourceId) {
                response.push({
                    resourceId: fsxCredentials.resourceId,
                    resourceType: RESOURCESTYPE.FSX,
                    fsxnError: fsxResult.ontaperror
                });
                paramsToDelete.push(`${SSM_PARAM_PREFIX}${fsxCredentials.resourceId}`);
            } else if (fsxResult.ontapconnectivity === true && fsxResult.fsxId === fsxCredentials.resourceId) {
                response.push({
                    resourceId: fsxCredentials.resourceId,
                    resourceType: RESOURCESTYPE.FSX
                });
                await registerFsxOntapCredentials(
                    accountId,
                    credentialsId,
                    region,
                    fsxCredentials.resourceId,
                    fsxCredentials.password
                );
            }
        });
    }

    if (oracleCredentials.length) {
        parsedResponse.instances.forEach((instance: OracleInstanceRegistration) => {
            if (instance.oracleInstanceConnectivity === false) {
                instancesToBeDeleted.push(instance.oracleInstanceName);
                response.push({
                    resourceId: instance.oracleInstanceName,
                    resourceType: RESOURCESTYPE.ORACLE,
                    databaseServerError: instance.oracleError,
                    manageReadiness: {
                        oracle: {
                            missingPermissions: ['Invalid credentials provided'],
                            missingModules
                        }
                    }
                });
            } else if (instance.oracleInstanceConnectivity === true) {
                const { oracleInstanceName, oracleEdition } = instance;
                const missingPermissions = instanceIdToMissingPermissionsMap.get(oracleInstanceName) || [];
                const remediationMissingPermissions =
                    instanceIdToRemediationMissingPermissionsMap.get(oracleInstanceName) || [];
                response.push({
                    resourceId: oracleInstanceName,
                    resourceType: RESOURCESTYPE.ORACLE,
                    databaseServerEdition: oracleEdition,
                    manageReadiness: {
                        oracle: {
                            missingPermissions,
                            missingModules
                        },
                        remediation: {
                            missingSqlPermissions: remediationMissingPermissions,
                            missingModules: []
                        }
                    }
                });
            }
        });
    }

    if (oracleAsmCredentials?.length) {
        const { asmResult: { error, valid } = {} } = parsedResponse;
        const oracleAsmError = error || !valid ? 'Invalid credentials provided' : undefined;
        if (valid === false) {
            instancesToBeDeleted.push(...oracleAsmCredentials.map(({ resourceId }) => `${resourceId}${TEMP}`));
        }

        response.push({
            resourceId: instanceId,
            resourceType: RESOURCESTYPE.ORACLE_ASM,
            ...(oracleAsmError && { oracleAsmError })
        });
    }

    await rewriteOrDeleteSSMParameter(
        credentialsId,
        region,
        instanceIds,
        paramsToDelete,
        instancesToBeDeleted,
        fsxCredentials!,
        oracleCredentials,
        [],
        allDatabaseCredentials,
        [],
        oracleAsmCredentials,
        allOracleAsmCredentials
    );

    return response;
}

async function verifyAndCreateCredentials(
    credentialsId: string,
    region: string,
    instanceId: string,
    fsxCredentials: RegisterCredentialsType | undefined,
    databaseCredentials: RegisterCredentialsType[],
    windowsUserCredentials: RegisterCredentialsType[],
    oracleAsmCredentials: RegisterCredentialsType[],
    instanceIds: string[]
) {
    logger.info('Verify and create credentials', { instanceId, databaseCredentialsLength: databaseCredentials.length });

    if (fsxCredentials) {
        const path = `${SSM_PARAM_PREFIX}${fsxCredentials.resourceId}`;
        let ssmParameter = await getParameter(credentialsId, region, path);
        if (!ssmParameter) {
            const newSSMParameters: string[] = await getAsyncLocalStorageResource(NEW_SSM_PARAMETERS);
            setAsyncLocalStorageResource(NEW_SSM_PARAMETERS, [...(newSSMParameters || []), fsxCredentials.resourceId]);
        } else {
            ssmParameter = ssmParameter.replace(/([{,])\s*(\w+)\s*:/g, '$1"$2":').replace(/'/g, '"');
            let value;
            try {
                value = JSON.parse(ssmParameter);
            } catch (error) {
                logger.error('Error parsing SSM parameter', { error });
            }
            const credsObject: SSMParameterObject = { path, value };
            setAsyncLocalStorageResource(EXISTING_FSX_PARAMETERS, credsObject);
        }
    }

    if (databaseCredentials.length || windowsUserCredentials.length || oracleAsmCredentials.length) {
        databaseCredentials = databaseCredentials.map(e => ({ ...e, resourceId: `${e.resourceId}${TEMP}` }));
        windowsUserCredentials = windowsUserCredentials.map(e => ({
            ...e,
            resourceId: `${e.resourceId}${TEMP}`
        }));
        oracleAsmCredentials = oracleAsmCredentials.map(e => ({
            ...e,
            resourceId: `${e.resourceId}${TEMP}`
        }));
        const existingParameters = await getParameter(credentialsId, region, `${SSM_PARAM_PREFIX}${instanceId}`);
        if (!existingParameters) {
            const newSSMParameters: string[] = await getAsyncLocalStorageResource(NEW_SSM_PARAMETERS);
            setAsyncLocalStorageResource(NEW_SSM_PARAMETERS, [...(newSSMParameters || []), ...instanceIds]);
        } else {
            const { sql, domain, oracle, asm } = JSON.parse(existingParameters);
            if (sql) {
                sql.forEach((e: SqlCredential) => {
                    const credToAdd = checkAndAddExistingSSMParameter(e, databaseCredentials, RESOURCESTYPE.MSSQL);
                    if (credToAdd) {
                        databaseCredentials.push(credToAdd);
                    }
                });
            }
            if (domain) {
                domain.forEach((e: SqlCredential) => {
                    const credToAdd = checkAndAddExistingSSMParameter(
                        e,
                        windowsUserCredentials,
                        RESOURCESTYPE.WINDOWS_USER
                    );
                    if (credToAdd) {
                        windowsUserCredentials.push(credToAdd);
                    }
                });
            }
            if (oracle) {
                oracle.forEach((e: OracleCredential) => {
                    const credToAdd = checkAndAddExistingSSMParameter(e, databaseCredentials, RESOURCESTYPE.ORACLE);
                    if (credToAdd) {
                        databaseCredentials.push(credToAdd);
                    }
                });
            }
            if (asm) {
                asm.forEach((e: OracleCredential) => {
                    const credToAdd = checkAndAddExistingSSMParameter(
                        e,
                        oracleAsmCredentials,
                        RESOURCESTYPE.ORACLE_ASM
                    );
                    if (credToAdd) {
                        oracleAsmCredentials.push(credToAdd);
                    }
                });
            }
        }
    }

    const creds = prepareParametersToStore(instanceIds, [
        ...(fsxCredentials ? [fsxCredentials] : []),
        ...databaseCredentials,
        ...windowsUserCredentials,
        ...oracleAsmCredentials
    ]);

    await ssmPutParameters(credentialsId, region, creds);

    return {
        allDatabaseCredentials: databaseCredentials,
        allWindowsUserCredentials: windowsUserCredentials,
        allOracleAsmCredentials: oracleAsmCredentials
    };
}

function checkAndAddExistingSSMParameter(
    currentCred: SqlCredential | OracleCredential,
    allCreds: RegisterCredentialsType[],
    type: RESOURCESTYPE
) {
    let instanceName: string | undefined;
    if ('sqlinstancename' in currentCred) {
        instanceName = currentCred.sqlinstancename;
    } else if ('oracleinstancename' in currentCred) {
        instanceName = currentCred.oracleinstancename;
    }

    // Check if the object already exists in databaseCredentials
    const isDuplicate = allCreds.some(
        cred =>
            cred.resourceId === instanceName &&
            cred.username === currentCred.username &&
            cred.password === currentCred.password
    );

    if (!isDuplicate && instanceName) {
        return {
            resourceId: instanceName,
            resourceType: type,
            username: currentCred.username,
            password: currentCred.password
        };
    }
}

async function deleteSSMParameter(credentialsId: string, region: string, ssmParameterNames: string[]) {
    logger.info('Delete SSM parameter', { credentialsId, region, ssmParameterNames });

    const newlyAddedSSMParameters: string[] = (await getAsyncLocalStorageResource(NEW_SSM_PARAMETERS)) || [];
    const ssmParamRegex = /\/netapp\/wlmdb\/(.*)/;

    if (!isEmpty(newlyAddedSSMParameters) && !isEmpty(ssmParameterNames)) {
        const filteredSSMParameters = (ssmParameterNames || []).filter(param => {
            const [, lastPart] = param.match(ssmParamRegex) || [];
            return newlyAddedSSMParameters.includes(lastPart);
        });

        if (filteredSSMParameters?.length) {
            await deleteParameters(credentialsId, region, filteredSSMParameters);
        }
    }
}

async function verifyAndAddFSxOntapCredentials(
    accountId: string,
    credentialsId: string,
    region: string,
    fsxNId: string
) {
    logger.info('Verify and add FSx ONTAP credentials', { accountId, credentialsId, region, fsxStorageId: fsxNId });

    if (!isEmpty(fsxNId)) {
        // Check if the FSx credentials are already present in SSM parameter store
        const fsxCredentials = await getParameter(credentialsId, region, `${SSM_PARAM_PREFIX}${fsxNId}`);

        if (!fsxCredentials) {
            let credentials;

            try {
                ({ credentials } = await listFsxOntapCredentials(accountId, fsxNId));

                if (isEmpty(credentials)) {
                    throw new Error('FSx for ONTAP storage credentials not found');
                }
            } catch (error: any) {
                throw createError(
                    HttpErrorCodes.INTERNAL_SERVER_ERROR,
                    `Unable to register the instance. Reason: FSx for ONTAP storage '${fsxNId}' isn't registered with FSxN core service.`
                );
            }

            const preparedCreds = prepareParametersToStore(
                [''],
                [
                    {
                        resourceId: fsxNId,
                        resourceType: RESOURCESTYPE.FSX,
                        username: credentials?.userName,
                        password: credentials?.password
                    }
                ]
            );

            await ssmPutParameters(credentialsId, region, preparedCreds);
        }
    }
}

async function unmanageDatabaseInstance(
    accountId: string,
    credentialsId: string,
    resourceId: string,
    databaseInstanceList: string
) {
    logger.info('Unmanaging database instances', { accountId, credentialsId, resourceId, databaseInstanceList });

    const databaseInstanceResponse: {
        databaseInstanceId: string;
        status: string;
        errorMessage?: string;
    }[] = [];

    databaseInstanceList = databaseInstanceList.replace(/ /g, '');
    if (databaseInstanceList.length > 0) {
        const databaseInstanceIds = databaseInstanceList.split(',');

        const preDeleteResult = await getPaginatedDatabaseInstances(accountId, {
            credentialsId,
            resourceId,
            shouldIncludeResource: true
        });
        const preDeleteDatabaseInstances = Array.isArray(preDeleteResult) ? preDeleteResult : preDeleteResult.items;

        const instanceDetails = preDeleteDatabaseInstances.find(item =>
            databaseInstanceIds.includes((item as { database_instance_id: string }).database_instance_id)
        );
        const resourceDetails = preDeleteDatabaseInstances[0]?.resource;

        updateLongRunningAuditGroup(
            undefined,
            undefined,
            getServerNameWithHostname(
                resourceDetails?.resource_name ?? undefined,
                instanceDetails?.database_instance_name
            )
        );

        await deleteDatabaseInstance(accountId, credentialsId, resourceId, databaseInstanceIds);

        const postDeleteResult = await getPaginatedDatabaseInstances(accountId, { credentialsId, resourceId });
        const postDeleteDatabaseInstances = Array.isArray(postDeleteResult) ? postDeleteResult : postDeleteResult.items;

        databaseInstanceIds.forEach(databaseInstanceId => {
            if (preDeleteDatabaseInstances.some(elem => elem.database_instance_id === databaseInstanceId)) {
                if (postDeleteDatabaseInstances.some(elem => elem.database_instance_id === databaseInstanceId)) {
                    databaseInstanceResponse.push({ databaseInstanceId, status: 'failed' });
                } else {
                    databaseInstanceResponse.push({ databaseInstanceId, status: 'success' });
                }
            } else {
                databaseInstanceResponse.push({
                    databaseInstanceId,
                    status: 'failed',
                    errorMessage: 'Instance does not exist.'
                });
            }
        });

        // When all database instances are removed, the EC2 ceases to be a
        // managed resource, since  we aren't managing any SQL Server instance.
        // So we need to remove the EC2 resource from wlmdb.resource table.
        if (postDeleteDatabaseInstances.length <= 0 && !IS_DEMO_FLOW) {
            deleteResource(accountId, resourceId, credentialsId);
        }
    }

    return {
        resourceId,
        items: databaseInstanceResponse
    };
}

async function checkCredentialsExistence(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceId: string,
    resourceId: string
) {
    logger.info('Checking credentials existence', { accountId, credentialsId, region, instanceId, resourceId });

    const { domain: domainCredentials = [] } = await getEc2SqlParameters(credentialsId, region, instanceId);
    if (isEmpty(domainCredentials)) {
        return {
            exists: false,
            error: `No credentials found in parameter store for instance ${instanceId}.`
        };
    }

    const { username, password } =
        domainCredentials.find(
            ({ sqlinstancename }: SqlCredential) =>
                sqlinstancename === resourceId || sqlinstancename === DEFAULT_INSTANCE_NAME
        ) || {};

    if (!username || !password) {
        return {
            exists: false,
            error: `Credentials matching the resource ID ${resourceId} not found for instance ${instanceId}.`
        };
    }

    return {
        exists: true
    };
}

export {
    registerDatabaseServerInstances,
    registerResourceCredentials,
    manageSqlServerV2,
    validateAndStoreDiscoveredParameters,
    validateOracleCredentials,
    unmanageDatabaseInstance,
    checkCredentialsExistence
};
