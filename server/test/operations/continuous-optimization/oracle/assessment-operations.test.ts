import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { createResource, deleteResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import {
    fetchOracleDriftAssessment,
    fetchOracleDriftAssessmentPerAccount,
    fetchOracleDriftAssessmentPerHost,
    onDemandTriggerOracleDriftAssessment
} from '../../../../src/operations/continuous-optimization/oracle/assessment-operations';
import { AssessmentCategoriesOracle, AssessmentTriggeredBy } from '../../../../src/utils/continous-optimization-consts';
import { oracleAssessmentMetadata, oracleInstanceMappedVolMetadata } from './oracle-assessment-metadata';
import { createDatabaseInstanceConfigData } from '../../../../src/lib/database/database-instance-config';
import { OracleGenericParameterDriftResponseType } from '../../../../src/routes/types/oracle-continuous-optimization.types';
import { ORACLE_STORAGE_ASSESSMENT_DATA } from '../../../../src/utils/demo-utils/demoMockdata';
import { STORAGE_PROTOCOLS } from '../../../../src/utils/consts';

const credentialsId = DEFAULT_AWS_CREDENTIALS_ID;
const region = DEFAULT_AWS_REGION;
const dbInstanceSid = 'oradbsan';
const dbNfsInstanceSid = 'mynas';
const accountId = ACCOUNT_ID;
const node1InstanceId = 'i-03ed3dc17db570670';
const fsxNId = 'fs-0f53fbecdd3d85fb2';
const resourceId = '6cbdabbfe3fb147e';

const createDatabaseInstanceRecord = (
    instanceId: string,
    storageProtocol?: string,
    resourceIdOverride: string = resourceId
) => ({
    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
    region: DEFAULT_AWS_REGION,
    resourceId: resourceIdOverride,
    databaseInstanceId: instanceId,
    databaseInstanceName: instanceId,
    isDefault: true,
    source: 'deployment',
    sqlDeploymentType: 'Standalone',
    fsxSvmId: { [fsxNId]: 'svm-0123456789abcdef0' },
    fsxnIds: fsxNId,
    databaseType: 'Oracle',
    metadata: oracleAssessmentMetadata,
    ...(storageProtocol && { storageProtocol })
});

const createConfigDataRecord = (
    instanceId: string,
    configData: unknown,
    configType: string,
    creationTime?: Date,
    resourceIdOverride: string = resourceId
) => ({
    account_id: ACCOUNT_ID,
    credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
    region: DEFAULT_AWS_REGION,
    resource_id: resourceIdOverride,
    database_instance_id: instanceId,
    creation_time: creationTime ?? new Date(),
    last_updated: new Date(),
    config_data: configData,
    config_data_type: configType
});

const storageAssessmentData = ORACLE_STORAGE_ASSESSMENT_DATA as Record<string, unknown>;
const oracleParamsOs = storageAssessmentData.os as Record<string, unknown>;

const computeOracleParamsPayload = {
    os: {
        'oracle-parameters': oracleParamsOs['oracle-parameters'],
        'oracle-parameters-from-init': oracleParamsOs['oracle-parameters-from-init']
    }
};

const computeHostOsAssessmentData = {
    computeHostOs: {
        transparentHugepages: oracleParamsOs['transparent-hugepages'],
        tcpAdvancedOptions: oracleParamsOs['tcp-advanced-options']
    },
    lastAssessedDate: new Date().getTime().toString()
};

const allOptimizedComputeHostOsAssessmentData = {
    computeHostOs: {
        transparentHugepages: {
            error: null,
            'thp-status': 'never',
            'thp-disabled': true
        },
        tcpAdvancedOptions: {
            error: null,
            'tcp-features': {
                'tcp-sack-value': '1',
                'tcp-sack-enabled': true,
                'tcp-timestamps-value': '1',
                'tcp-timestamps-enabled': true,
                'tcp-window-scaling-value': '1',
                'tcp-window-scaling-enabled': true
            }
        }
    },
    lastAssessedDate: new Date().getTime().toString()
};

const allOptimizedComputeOracleParamsPayload = {
    os: {
        'oracle-parameters': {
            error: null,
            'filesystemio-options': {
                found: true,
                value: 'setall'
            }
        },
        'oracle-parameters-from-init': {
            error: null,
            'db-file-multiblock-read-count-in-init': []
        }
    }
};

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId,
        resourceName: dbInstanceSid,
        resourceType: 'ORACLE',
        coRelationId: fsxNId,
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId
        },
        assessmentData: computeHostOsAssessmentData
    });

    await Promise.all([
        upsertDatabaseInstance(ACCOUNT_ID, createDatabaseInstanceRecord(dbInstanceSid)),
        upsertDatabaseInstance(ACCOUNT_ID, createDatabaseInstanceRecord(dbNfsInstanceSid, 'NFS'))
    ]);

    const creationTime = new Date();

    const configDataRecords = [
        createConfigDataRecord(dbInstanceSid, storageAssessmentData, AssessmentCategoriesOracle.STORAGE, creationTime),
        createConfigDataRecord(
            dbInstanceSid,
            computeOracleParamsPayload,
            AssessmentCategoriesOracle.COMPUTE,
            creationTime
        ),
        createConfigDataRecord(
            dbInstanceSid,
            oracleInstanceMappedVolMetadata('iSCSI'),
            AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
        ),
        createConfigDataRecord(
            dbNfsInstanceSid,
            storageAssessmentData,
            AssessmentCategoriesOracle.STORAGE,
            creationTime
        ),
        createConfigDataRecord(
            dbNfsInstanceSid,
            oracleInstanceMappedVolMetadata('NFS'),
            AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
        )
    ];

    await createDatabaseInstanceConfigData(configDataRecords);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, resourceId);
});
describe('Oracle assessment operations', () => {
    it('should return drift assessment data', async () => {
        const assessmentData = await fetchOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            resourceId,
            dbInstanceSid,
            'storage,compute'
        );

        expect(assessmentData).toBeDefined();
        expect(assessmentData.metadata.fileSystemId).toBe('fs-0f53fbecdd3d85fb2');
        expect(assessmentData.metadata.ec2InstanceId).toBe(node1InstanceId);
        expect(assessmentData.assessments.filter(a => a.subType === 'configuration').length).toBeGreaterThan(0);
        expect(assessmentData.assessments.filter(a => a.subType === 'layout').length).toBeGreaterThan(0);

        expect(assessmentData.assessments.filter(a => a.subType === 'configuration').length).toBeGreaterThanOrEqual(9);

        const osAssessment = assessmentData.assessments;

        const multipathIo = osAssessment.find(
            item => item.id === 'multipath-io'
        ) as OracleGenericParameterDriftResponseType;
        expect(multipathIo).toBeDefined();

        expect(multipathIo.status).toBe('not-optimized');
        expect(multipathIo.recommended).toBe('enabled');
        expect(multipathIo.severity).toBe('critical');
        expect(multipathIo.totalObjectsInViolation).toBe(1);

        const hostUtilities = osAssessment.find(
            item => item.id === 'host-utilities'
        ) as OracleGenericParameterDriftResponseType;
        expect(hostUtilities).toBeDefined();

        expect(hostUtilities.status).toBe('not-optimized');
        expect(hostUtilities.recommended).toBe('installed');
        expect(hostUtilities.severity).toBe('warning');
        expect(hostUtilities.totalObjectsInViolation).toBe(1);

        const multipathSessions = osAssessment.find(
            item => item.id === 'multipath-io-sessions'
        ) as OracleGenericParameterDriftResponseType;
        expect(multipathSessions).toBeDefined();

        expect(multipathSessions.status).toBe('not-optimized');
        expect(multipathSessions.recommended).toBe('4');
        expect(multipathSessions.severity).toBe('warning');
        expect(multipathSessions.totalObjectsInViolation).toBe(1);
        expect(multipathSessions.objectsInViolation).toEqual([node1InstanceId]);

        // Compute host/OS drift — top-level fields from resource.assessment_data.computeHostOs (THP/TCP)
        const hugepages = assessmentData.assessments.find(
            i => i.id === 'transparent-hugepages'
        ) as OracleGenericParameterDriftResponseType;
        expect(hugepages).toBeDefined();

        expect(hugepages.status).toBe('not-optimized');
        expect(hugepages.recommended).toBe('disabled');
        expect(hugepages.totalObjectsInViolation).toBe(1);

        const iscsiTimeout = osAssessment.find(
            item => item.id === 'iscsi-replacement-timeout'
        ) as OracleGenericParameterDriftResponseType;
        expect(iscsiTimeout).toBeDefined();

        expect(iscsiTimeout.status).toBe('not-optimized');
        expect(iscsiTimeout.recommended).toBe('5');
        expect(iscsiTimeout.severity).toBe('critical');
        expect(iscsiTimeout.violationDetails?.[0]?.objectName).toBe('iscsi-replacement-timeout');
        expect(iscsiTimeout.violationDetails?.[0]?.value).toBe('120');

        const friendlyNames = osAssessment.find(
            item => item.id === 'multipath-friendly-names'
        ) as OracleGenericParameterDriftResponseType;
        expect(friendlyNames).toBeDefined();

        expect(friendlyNames.status).toBe('not-optimized');
        expect(friendlyNames.recommended).toBe('enabled');
        expect(friendlyNames.violationDetails?.[0]?.objectName).toBe('user_friendly_names');
        expect(friendlyNames.violationDetails?.[0]?.value).toBe('no');

        // Compute host/OS drift — top-level from resource.assessment_data.computeHostOs
        const tcpOptions = assessmentData.assessments.find(
            i => i.id === 'tcp-advanced-options'
        ) as OracleGenericParameterDriftResponseType;
        expect(tcpOptions).toBeDefined();

        expect(tcpOptions.status).toBe('not-optimized');
        expect(tcpOptions.recommended).toBe('enabled');
        expect(tcpOptions.totalObjectsInViolation).toBe(1);

        // Compute host/OS drift — top-level from database_instance_config_data compute row (Oracle params)
        const filesystemIo = assessmentData.assessments.find(
            i => i.id === 'filesystems-io-options'
        ) as OracleGenericParameterDriftResponseType;
        expect(filesystemIo).toBeDefined();

        expect(filesystemIo.status).toBe('not-optimized');
        expect(filesystemIo.recommended).toBe('setall');
        expect((filesystemIo as Record<string, unknown>).resourceType).toBe('EC2 Instance');
        expect(filesystemIo.violationDetails?.[0]?.value).toBe('none');

        const multipathReadcount = assessmentData.assessments.find(
            i => i.id === 'multiblock-readcount'
        ) as OracleGenericParameterDriftResponseType;
        expect(multipathReadcount).toBeDefined();

        expect(multipathReadcount.status).toBe('not-optimized');
        expect(multipathReadcount.recommended).toBe('disabled');
        expect((multipathReadcount as Record<string, unknown>).resourceType).toBe('EC2 Instance');
        expect(multipathReadcount.totalObjectsInViolation).toBe(1);

        const multipathConfig = osAssessment.find(
            item => item.id === 'multipath-configuration'
        ) as OracleGenericParameterDriftResponseType;
        expect(multipathConfig).toBeDefined();

        expect(multipathConfig.status).toBe('not-optimized');
        expect(multipathConfig.severity).toBe('critical');
        expect((multipathConfig as Record<string, unknown>).resourceType).toBe('EC2 Instance');
        expect(multipathConfig.violationDetails?.length).toBeGreaterThan(0);

        const pathSelectorViolation = multipathConfig.violationDetails?.find(v => v.objectName === 'path_selector');
        expect(pathSelectorViolation?.value).toBe('not found');
    });

    it('should calculate demo compute drift from resource metadata before reading optimized mock assessment data', async () => {
        const demoMetadataResourceId = 'oracle-demo-metadata-resource';
        const demoMetadataInstanceId = 'oracle-demo-metadata-instance';
        await createResource(ACCOUNT_ID, {
            resourceId: demoMetadataResourceId,
            resourceName: dbInstanceSid,
            resourceType: 'ORACLE',
            coRelationId: fsxNId,
            cloudProviderAccountId: 'test-aws-account',
            cloudProviderName: 'AWS',
            region: DEFAULT_AWS_REGION,
            credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
            storageType: 'FSXN',
            metadata: {
                node1InstanceId,
                oracleComputeHostOsDemoOptimized: ['tcp-advanced-options']
            },
            assessmentData: allOptimizedComputeHostOsAssessmentData
        });

        try {
            await upsertDatabaseInstance(
                ACCOUNT_ID,
                createDatabaseInstanceRecord(demoMetadataInstanceId, STORAGE_PROTOCOLS.ISCSI, demoMetadataResourceId)
            );
            const creationTime = new Date();
            await createDatabaseInstanceConfigData([
                createConfigDataRecord(
                    demoMetadataInstanceId,
                    storageAssessmentData,
                    AssessmentCategoriesOracle.STORAGE,
                    creationTime,
                    demoMetadataResourceId
                ),
                createConfigDataRecord(
                    demoMetadataInstanceId,
                    allOptimizedComputeOracleParamsPayload,
                    AssessmentCategoriesOracle.COMPUTE,
                    creationTime,
                    demoMetadataResourceId
                ),
                createConfigDataRecord(
                    demoMetadataInstanceId,
                    oracleInstanceMappedVolMetadata('iSCSI'),
                    AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES,
                    creationTime,
                    demoMetadataResourceId
                )
            ]);

            const assessmentData = await fetchOracleDriftAssessment(
                accountId,
                credentialsId,
                region,
                demoMetadataResourceId,
                demoMetadataInstanceId,
                'compute'
            );

            const findItem = (name: string) =>
                assessmentData.assessments.find(i => i.id === name) as OracleGenericParameterDriftResponseType;
            expect(findItem('tcp-advanced-options').status).toBe('optimized');
            expect(findItem('transparent-hugepages').status).toBe('not-optimized');
            expect(findItem('filesystems-io-options').status).toBe('not-optimized');
            expect(findItem('multiblock-readcount').status).toBe('not-optimized');
        } finally {
            await deleteResource(ACCOUNT_ID, demoMetadataResourceId);
        }
    });

    it('should return drift assessment data at host level', async () => {
        const assessmentData = await fetchOracleDriftAssessmentPerHost(accountId, credentialsId, region, resourceId);
        expect(assessmentData).toBeDefined();
        expect(assessmentData.instancesAssessment.length).toBeGreaterThan(0);
    });
    it('should return drift assessment data at account level', async () => {
        const assessmentData = await fetchOracleDriftAssessmentPerAccount(accountId, credentialsId, region);
        expect(assessmentData).toBeDefined();
        expect(assessmentData.assessmentsPerAccount.length).toBeGreaterThan(0);
    });
    it('should return nfs drift assessment data', async () => {
        const assessmentData = await fetchOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            resourceId,
            dbNfsInstanceSid,
            'storage'
        );
        expect(assessmentData).toBeDefined();
        expect(assessmentData.metadata.fileSystemId).toBe('fs-0f53fbecdd3d85fb2');
        expect(assessmentData.metadata.ec2InstanceId).toBe(node1InstanceId);
        expect(assessmentData.assessments.filter(a => a.subType === 'configuration').length).toBeGreaterThan(0);
        expect(assessmentData.assessments.filter(a => a.subType === 'layout').length).toBeGreaterThan(0);

        expect(assessmentData.assessments.filter(a => a.subType === 'configuration').length).toBeGreaterThan(0);

        const volumeAssessment = assessmentData.assessments;
        const nfsRootonlyAssessment = volumeAssessment?.find(
            item => item.id === 'nfs-rootonly'
        ) as OracleGenericParameterDriftResponseType;

        expect(nfsRootonlyAssessment).toBeDefined();
        expect(nfsRootonlyAssessment.id).toBe('nfs-rootonly');
        expect(nfsRootonlyAssessment.recommended).toBe('disabled');
        expect(nfsRootonlyAssessment.status).toBe('not-optimized');
        expect(nfsRootonlyAssessment.severity).toBe('critical');
        expect((nfsRootonlyAssessment as Record<string, unknown>).resourceType).toBe('Volume');

        const osAssessment = assessmentData.assessments;
        const nfsMountOptions = osAssessment?.find(
            item => item.id === 'nfs-mount-options-databasefiles'
        ) as OracleGenericParameterDriftResponseType;

        expect(nfsMountOptions).toBeDefined();
        expect(nfsMountOptions.id).toBe('nfs-mount-options-databasefiles');
        expect(nfsMountOptions.status).toBe('not-optimized');
        expect(nfsMountOptions.severity).toBe('warning');
        expect(nfsMountOptions.totalObjectsAssessed).toBeGreaterThanOrEqual(0);
        expect(nfsMountOptions.totalObjectsInViolation).toBeGreaterThanOrEqual(0);
        expect((nfsMountOptions as Record<string, unknown>).resourceType).toBe('NFS Mount');

        const kernelParams = osAssessment?.find(
            item => item.id === 'kernel-parameters'
        ) as OracleGenericParameterDriftResponseType;

        expect(kernelParams).toBeDefined();
        expect(kernelParams.id).toBe('kernel-parameters');
        expect(kernelParams.status).toBe('not-optimized');
        expect(kernelParams.severity).toBe('critical');
        expect(kernelParams.totalObjectsAssessed).toBe(1);
        expect(kernelParams.totalObjectsInViolation).toBe(1);
        expect((kernelParams as Record<string, unknown>).resourceType).toBe('EC2 Instance');

        const idmapdDomain = osAssessment?.find(
            item => item.id === 'nfsv4-domain-name'
        ) as OracleGenericParameterDriftResponseType;

        expect(idmapdDomain).toBeDefined();
        expect(idmapdDomain.id).toBe('nfsv4-domain-name');
        expect(idmapdDomain.status).toBe('not-optimized');
        expect(idmapdDomain.severity).toBe('critical');
        expect(idmapdDomain.totalObjectsAssessed).toBe(1);
        expect(idmapdDomain.totalObjectsInViolation).toBe(1);
        expect((idmapdDomain as Record<string, unknown>).resourceType).toBe('EC2 Instance');

        const nfsCachingOptions = osAssessment?.find(
            item => item.id === 'nfs-caching-options'
        ) as OracleGenericParameterDriftResponseType;

        expect(nfsCachingOptions).toBeDefined();
        expect(nfsCachingOptions.id).toBe('nfs-caching-options');
        expect(nfsCachingOptions.status).toBe('not-optimized');
        expect(nfsCachingOptions.severity).toBe('warning');
        expect(nfsCachingOptions.totalObjectsAssessed).toBe(3);
        expect(nfsCachingOptions.totalObjectsInViolation).toBe(3);
        expect((nfsCachingOptions as Record<string, unknown>).resourceType).toBe('NFS Mount');
    });
    it('should return nfs/iscsi drift assessment data', async () => {
        const assessmentData = await fetchOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            resourceId,
            dbNfsInstanceSid,
            'storage'
        );
        expect(assessmentData).toBeDefined();
        expect(assessmentData.assessments.filter(a => a.subType === 'sizing').length).toBeGreaterThan(0);

        const swapSpaceAssessment = assessmentData.assessments.find(
            item => item.id === 'swap-space'
        ) as OracleGenericParameterDriftResponseType;

        expect(swapSpaceAssessment).toBeDefined();
        expect(swapSpaceAssessment.id).toBe('swap-space');
        expect(swapSpaceAssessment.status).toBe('not-optimized');
        expect(swapSpaceAssessment.recommended).toBe('3 - 4 GB');
        expect(swapSpaceAssessment.severity).toBe('critical');
        expect(swapSpaceAssessment.totalObjectsAssessed).toBe(1);
        expect(swapSpaceAssessment.totalObjectsInViolation).toBe(1);
        expect((swapSpaceAssessment as Record<string, unknown>).resourceType).toBe('EC2 instance');

        const headroomAssessment = assessmentData.assessments.find(
            item => item.id === 'headroom'
        ) as OracleGenericParameterDriftResponseType;

        expect(headroomAssessment).toBeDefined();
        expect(headroomAssessment.id).toBe('headroom');
        expect(headroomAssessment.status).toBe('under-provisioned');
        expect(headroomAssessment.current).toBe('10%');
        expect(headroomAssessment.severity).toBe('critical');
        expect(headroomAssessment.totalObjectsAssessed).toBe(1);
        expect(headroomAssessment.totalObjectsInViolation).toBe(1);
        expect(headroomAssessment.resourceType).toBe('File system (FSx for ONTAP)');
    });
    it('should return job id from on-demand assessment trigger', async () => {
        const { jobId } = await onDemandTriggerOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            resourceId,
            dbInstanceSid,
            AssessmentTriggeredBy.SYSTEM
        );
        expect(jobId).toBeDefined();
    });
});
