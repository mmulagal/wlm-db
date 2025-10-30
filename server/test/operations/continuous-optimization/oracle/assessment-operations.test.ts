import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/aws/fsx-scope';
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
import { StorageParameterDriftResponseType } from '../../../../src/routes/types/mssql-continuous-optimisation.types';
import { OracleGenericParameterDriftResponseType } from '../../../../src/routes/types/oracle-continuous-optimization.types';
import { ORACLE_STORAGE_ASSESSMENT_DATA } from '../../../../src/utils/demo-utils/demoInventoryData';

const credentialsId = DEFAULT_AWS_CREDENTIALS_ID;
const region = DEFAULT_AWS_REGION;
const dbInstanceSid = 'oradbsan';
const dbNfsInstanceSid = 'mynas';
const accountId = ACCOUNT_ID;
const node1InstanceId = 'i-03ed3dc17db570670';
const fsxNId = 'fs-0f53fbecdd3d85fb2';

const createDatabaseInstanceRecord = (instanceId: string, storageProtocol?: string) => ({
    credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
    region: DEFAULT_AWS_REGION,
    resourceId: '6cbdabbfe3fb147e',
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

// Helper function to create config data records
const createConfigDataRecord = (instanceId: string, configData: any, configType: string) => ({
    account_id: ACCOUNT_ID,
    credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
    region: DEFAULT_AWS_REGION,
    resource_id: '6cbdabbfe3fb147e',
    database_instance_id: instanceId,
    creation_time: new Date(),
    last_updated: new Date(),
    config_data: configData,
    config_data_type: configType
});

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
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
        }
    });

    await Promise.all([
        upsertDatabaseInstance(ACCOUNT_ID, createDatabaseInstanceRecord(dbInstanceSid)),
        upsertDatabaseInstance(ACCOUNT_ID, createDatabaseInstanceRecord(dbNfsInstanceSid, 'NFS'))
    ]);

    const configDataRecords = [
        // iSCSI instance configs
        createConfigDataRecord(dbInstanceSid, ORACLE_STORAGE_ASSESSMENT_DATA, AssessmentCategoriesOracle.STORAGE),
        createConfigDataRecord(
            dbInstanceSid,
            oracleInstanceMappedVolMetadata('iSCSI'),
            AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
        ),
        // NFS instance configs
        createConfigDataRecord(dbNfsInstanceSid, ORACLE_STORAGE_ASSESSMENT_DATA, AssessmentCategoriesOracle.STORAGE),
        createConfigDataRecord(
            dbNfsInstanceSid,
            oracleInstanceMappedVolMetadata('NFS'),
            AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
        )
    ];

    await createDatabaseInstanceConfigData(configDataRecords);
});

afterAll(async () => {
    await deleteResource(ACCOUNT_ID, '6cbdabbfe3fb147e');
});
describe('Oracle assessment operations', () => {
    it('should return job id', async () => {
        const jobId = await onDemandTriggerOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            '6cbdabbfe3fb147e',
            dbInstanceSid,
            AssessmentTriggeredBy.SYSTEM
        );
        expect(jobId).toBeDefined();
    });
    it('should return drift assessment data', async () => {
        const assessmentData = await fetchOracleDriftAssessment(
            accountId,
            credentialsId,
            region,
            '6cbdabbfe3fb147e',
            dbInstanceSid,
            'storage'
        );

        expect(assessmentData).toBeDefined();
        expect(assessmentData.fileSystemId).toBe('fs-0f53fbecdd3d85fb2');
        expect(assessmentData.ec2InstanceId).toBe(node1InstanceId);
        expect(
            (assessmentData.storage as StorageParameterDriftResponseType)?.configuration?.volumes.length
        ).toBeGreaterThan(0);
        expect((assessmentData.storage as StorageParameterDriftResponseType)?.layout?.length).toBeGreaterThan(0);

        expect((assessmentData.storage as StorageParameterDriftResponseType)?.configuration.os?.length).toEqual(14);

        // Additional OS assessment assertions
        const osAssessment = (assessmentData.storage as StorageParameterDriftResponseType)?.configuration.os;

        // Test multipath-io assessment
        const multipathIo = osAssessment.find(
            item => item.name === 'multipath-io'
        ) as OracleGenericParameterDriftResponseType;
        expect(multipathIo).toBeDefined();

        expect(multipathIo.status).toBe('optimized');
        expect(multipathIo.recommended).toBe('enabled');
        expect(multipathIo.severity).toBe('critical');
        expect(multipathIo.totalObjectsInViolation).toBe(0);

        // Test host-utilities assessment
        const hostUtilities = osAssessment.find(
            item => item.name === 'host-utilities'
        ) as OracleGenericParameterDriftResponseType;
        expect(hostUtilities).toBeDefined();

        expect(hostUtilities.status).toBe('not-optimized');
        expect(hostUtilities.recommended).toBe('installed');
        expect(hostUtilities.severity).toBe('warning');
        expect(hostUtilities.totalObjectsInViolation).toBe(1);

        // Test multipath-io-sessions assessment
        const multipathSessions = osAssessment.find(
            item => item.name === 'multipath-io-sessions'
        ) as OracleGenericParameterDriftResponseType;
        expect(multipathSessions).toBeDefined();

        expect(multipathSessions.status).toBe('not-optimized');
        expect(multipathSessions.recommended).toBe('4');
        expect(multipathSessions.severity).toBe('warning');
        expect(multipathSessions.totalObjectsInViolation).toBe(1);
        expect(multipathSessions.objectsInViolation).toEqual([node1InstanceId]);

        // Test transparent-hugepages assessment
        const hugepages = osAssessment.find(
            item => item.name === 'transparent-hugepages'
        ) as OracleGenericParameterDriftResponseType;
        expect(hugepages).toBeDefined();

        expect(hugepages.status).toBe('not-optimized');
        expect(hugepages.recommended).toBe('disabled');
        expect(hugepages.totalObjectsInViolation).toBe(1);

        // Test selinux assessment
        const selinux = osAssessment.find(item => item.name === 'selinux') as OracleGenericParameterDriftResponseType;
        expect(selinux).toBeDefined();

        expect(selinux.status).toBe('not-optimized');
        expect(selinux.recommended).toBe('disabled');
        expect(selinux.severity).toBe('warning');
        expect(selinux.totalObjectsInViolation).toBe(1);
        expect(selinux.violationDetails?.[0]?.value).toBe('permissive');

        // Test iscsi-replacement-timeout assessment
        const iscsiTimeout = osAssessment.find(
            item => item.name === 'iscsi-replacement-timeout'
        ) as OracleGenericParameterDriftResponseType;
        expect(iscsiTimeout).toBeDefined();

        expect(iscsiTimeout.status).toBe('not-optimized');
        expect(iscsiTimeout.recommended).toBe('5');
        expect(iscsiTimeout.severity).toBe('critical');
        expect(iscsiTimeout.violationDetails?.[0]?.value).toBe('120');

        // Test multipath-friendly-names assessment
        const friendlyNames = osAssessment.find(
            item => item.name === 'multipath-friendly-names'
        ) as OracleGenericParameterDriftResponseType;
        expect(friendlyNames).toBeDefined();

        expect(friendlyNames.status).toBe('not-optimized');
        expect(friendlyNames.recommended).toBe('enabled');
        expect(friendlyNames.violationDetails?.[0]?.objectName).toBe('user_friendly_names');
        expect(friendlyNames.violationDetails?.[0]?.value).toBe('no');

        // Test tcp-advanced-options assessment
        const tcpOptions = osAssessment.find(
            item => item.name === 'tcp-advanced-options'
        ) as OracleGenericParameterDriftResponseType;
        expect(tcpOptions).toBeDefined();

        expect(tcpOptions.status).toBe('not-optimized');
        expect(tcpOptions.recommended).toBe('enabled');
        expect(tcpOptions.totalObjectsInViolation).toBe(1);

        // Test filesystems-io-options assessment (Database specific)
        const filesystemIo = osAssessment.find(
            item => item.name === 'filesystems-io-options'
        ) as OracleGenericParameterDriftResponseType;
        expect(filesystemIo).toBeDefined();

        expect(filesystemIo.status).toBe('not-optimized');
        expect(filesystemIo.recommended).toBe('setall');
        expect((filesystemIo as any).resourceType).toBe('EC2 Instance');
        expect(filesystemIo.violationDetails?.[0]?.value).toBe('none');

        // Test multiblock-readcount assessment (Database specific)
        const multipathReadcount = osAssessment.find(
            item => item.name === 'multiblock-readcount'
        ) as OracleGenericParameterDriftResponseType;
        expect(multipathReadcount).toBeDefined();

        expect(multipathReadcount.status).toBe('not-optimized');
        expect(multipathReadcount.recommended).toBe('disabled');
        expect((multipathReadcount as any).resourceType).toBe('EC2 Instance');
        expect(multipathReadcount.totalObjectsInViolation).toBe(1);

        // Test multipath-configuration assessment
        const multipathConfig = osAssessment.find(
            item => item.name === 'multipath-configuration'
        ) as OracleGenericParameterDriftResponseType;
        expect(multipathConfig).toBeDefined();

        expect(multipathConfig.status).toBe('not-optimized');
        expect(multipathConfig.severity).toBe('critical');
        expect((multipathConfig as any).resourceType).toBe('EC2 Instance');
        expect(multipathConfig.violationDetails?.length).toBeGreaterThan(0);

        // Verify specific multipath configuration violations
        const pathSelectorViolation = multipathConfig.violationDetails?.find(v => v.objectName === 'path_selector');
        expect(pathSelectorViolation?.value).toBe('not found');
    });
    it('should return drift assessment data at host level', async () => {
        const assessmentData = await fetchOracleDriftAssessmentPerHost(
            accountId,
            credentialsId,
            region,
            '6cbdabbfe3fb147e'
        );
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
            '6cbdabbfe3fb147e',
            dbNfsInstanceSid,
            'storage'
        );
        expect(assessmentData).toBeDefined();
        expect(assessmentData.fileSystemId).toBe('fs-0f53fbecdd3d85fb2');
        expect(assessmentData.ec2InstanceId).toBe(node1InstanceId);
        expect(
            (assessmentData.storage as StorageParameterDriftResponseType)?.configuration?.volumes.length
        ).toBeGreaterThan(0);
        expect((assessmentData.storage as StorageParameterDriftResponseType)?.layout?.length).toBeGreaterThan(0);

        expect((assessmentData.storage as StorageParameterDriftResponseType)?.configuration.os?.length).toBeGreaterThan(
            0
        );

        // Test NFS-specific volume configuration - nfs-rootonly assessment
        const volumeAssessment = (assessmentData.storage as StorageParameterDriftResponseType)?.configuration?.volumes;
        const nfsRootonlyAssessment = volumeAssessment?.find(
            item => item.name === 'nfs-rootonly'
        ) as OracleGenericParameterDriftResponseType;

        expect(nfsRootonlyAssessment).toBeDefined();
        expect(nfsRootonlyAssessment.name).toBe('nfs-rootonly');
        expect(nfsRootonlyAssessment.recommended).toBe('disabled');
        expect(nfsRootonlyAssessment.status).toBe('optimized');
        expect(nfsRootonlyAssessment.severity).toBe('critical');
        expect((nfsRootonlyAssessment as any).resourceType).toBe('Volume');

        // Test NFS-specific OS configuration - nfs-mount-options assessment
        const osAssessment = (assessmentData.storage as StorageParameterDriftResponseType)?.configuration.os;
        const nfsMountOptions = osAssessment?.find(
            item => item.name === 'nfs-mount-options-databasefiles'
        ) as OracleGenericParameterDriftResponseType;

        expect(nfsMountOptions).toBeDefined();
        expect(nfsMountOptions.name).toBe('nfs-mount-options-databasefiles');
        expect(nfsMountOptions.status).toBe('not-optimized');
        expect(nfsMountOptions.severity).toBe('warning');
        expect(nfsMountOptions.totalObjectsAssessed).toBeGreaterThanOrEqual(0);
        expect(nfsMountOptions.totalObjectsInViolation).toBeGreaterThanOrEqual(0);
        expect((nfsMountOptions as any).resourceType).toBe('EC2 Instance');

        // Test NFS-specific OS configuration - kernel parameters assessment
        const kernelParams = osAssessment?.find(
            item => item.name === 'kernel-parameters'
        ) as OracleGenericParameterDriftResponseType;

        expect(kernelParams).toBeDefined();
        expect(kernelParams.name).toBe('kernel-parameters');
        expect(kernelParams.status).toBe('not-optimized');
        expect(kernelParams.severity).toBe('critical');
        expect(kernelParams.totalObjectsAssessed).toBe(1);
        expect(kernelParams.totalObjectsInViolation).toBe(1);
        expect((kernelParams as any).resourceType).toBe('EC2 Instance');

        // Test NFS-specific OS configuration - nfsv4-domain-name assessment
        const idmapdDomain = osAssessment?.find(
            item => item.name === 'nfsv4-domain-name'
        ) as OracleGenericParameterDriftResponseType;

        expect(idmapdDomain).toBeDefined();
        expect(idmapdDomain.name).toBe('nfsv4-domain-name');
        expect(idmapdDomain.status).toBe('not-optimized');
        expect(idmapdDomain.severity).toBe('critical');
        expect(idmapdDomain.totalObjectsAssessed).toBe(1);
        expect(idmapdDomain.totalObjectsInViolation).toBe(1);
        expect((idmapdDomain as any).resourceType).toBe('EC2 Instance');

        // Test NFS-specific OS configuration - nfs-caching-options NFS assessment
        const nfsCachingOptions = osAssessment?.find(
            item => item.name === 'nfs-caching-options'
        ) as OracleGenericParameterDriftResponseType;

        expect(nfsCachingOptions).toBeDefined();
        expect(nfsCachingOptions.name).toBe('nfs-caching-options');
        expect(nfsCachingOptions.status).toBe('not-optimized');
        expect(nfsCachingOptions.severity).toBe('warning');
        expect(nfsCachingOptions.totalObjectsAssessed).toBe(1);
        expect(nfsCachingOptions.totalObjectsInViolation).toBe(1);
        expect((nfsCachingOptions as any).resourceType).toBe('EC2 Instance');
    });
});
