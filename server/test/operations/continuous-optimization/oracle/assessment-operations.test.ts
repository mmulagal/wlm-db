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
import {
    oracleAssessmentMetadata,
    storageAssessmnetMetadata,
    oracleInstanceMappedVolMetadata
} from './oracle-assessment-metadata';
import { createDatabaseInstanceConfigData } from '../../../../src/lib/database/database-instance-config';
import { StorageParameterDriftResponseType } from '../../../../src/routes/types/mssql-continuous-optimisation.types';
import { OracleGenericParameterDriftResponseType } from '../../../../src/routes/types/oracle-continuous-optimization.types';

const credentialsId = DEFAULT_AWS_CREDENTIALS_ID;
const region = DEFAULT_AWS_REGION;
const dbInstanceSid = 'oradbsan';
const accountId = ACCOUNT_ID;
const node1InstanceId = 'i-03ed3dc17db570670';
const fsxNId = 'fs-0f53fbecdd3d85fb2';

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

    const DATABASE_INSTANCE_RECORD = {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: '6cbdabbfe3fb147e',
        databaseInstanceId: dbInstanceSid,
        databaseInstanceName: dbInstanceSid,
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'Standalone',
        fsxSvmId: { [fsxNId]: 'svm-0123456789abcdef0' },
        fsxnIds: fsxNId,
        databaseType: 'Oracle',
        metadata: oracleAssessmentMetadata
    };

    await upsertDatabaseInstance(ACCOUNT_ID, DATABASE_INSTANCE_RECORD);

    const DatabaseInstanceStorageConfigData = {
        account_id: ACCOUNT_ID,
        credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resource_id: '6cbdabbfe3fb147e',
        database_instance_id: dbInstanceSid,
        creation_time: new Date(),
        last_updated: new Date(),
        config_data: storageAssessmnetMetadata,
        config_data_type: AssessmentCategoriesOracle.STORAGE
    };

    const DatabaseInstanceMappedVolConfigData = {
        account_id: ACCOUNT_ID,
        credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resource_id: '6cbdabbfe3fb147e',
        database_instance_id: dbInstanceSid,
        creation_time: new Date(),
        last_updated: new Date(),
        config_data: oracleInstanceMappedVolMetadata,
        config_data_type: AssessmentCategoriesOracle.MAPPED_ONTAP_VOLUMES
    };
    await createDatabaseInstanceConfigData([DatabaseInstanceStorageConfigData, DatabaseInstanceMappedVolConfigData]);
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

        expect((assessmentData.storage as StorageParameterDriftResponseType)?.configuration.os?.length).toEqual(11);

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
        expect(multipathSessions.totalObjectsInViolation).toBe(2);
        expect(multipathSessions.objectsInViolation).toEqual(['172.31.48.72', '172.31.6.100']);

        // Test transparent-hugepages assessment
        const hugepages = osAssessment.find(
            item => item.name === 'transparent-hugepages'
        ) as OracleGenericParameterDriftResponseType;
        expect(hugepages).toBeDefined();

        expect(hugepages.status).toBe('optimized');
        expect(hugepages.recommended).toBe('disabled');
        expect(hugepages.totalObjectsInViolation).toBe(0);

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
        expect(friendlyNames.violationDetails?.[0]?.value).toBe('false');

        // Test tcp-advanced-options assessment
        const tcpOptions = osAssessment.find(
            item => item.name === 'tcp-advanced-options'
        ) as OracleGenericParameterDriftResponseType;
        expect(tcpOptions).toBeDefined();

        expect(tcpOptions.status).toBe('optimized');
        expect(tcpOptions.recommended).toBe('enabled');
        expect(tcpOptions.totalObjectsInViolation).toBe(0);

        // Test filesystems-io-options assessment (Database specific)
        const filesystemIo = osAssessment.find(
            item => item.name === 'filesystems-io-options'
        ) as OracleGenericParameterDriftResponseType;
        expect(filesystemIo).toBeDefined();

        expect(filesystemIo.status).toBe('not-optimized');
        expect(filesystemIo.recommended).toBe('setall');
        expect((filesystemIo as any).resourceType).toBe('Database');
        expect(filesystemIo.violationDetails?.[0]?.value).toBe('none');

        // Test multipath-readcount assessment (Database specific)
        const multipathReadcount = osAssessment.find(
            item => item.name === 'multipath-readcount'
        ) as OracleGenericParameterDriftResponseType;
        expect(multipathReadcount).toBeDefined();

        expect(multipathReadcount.status).toBe('not-optimized');
        expect(multipathReadcount.recommended).toBe('disabled');
        expect((multipathReadcount as any).resourceType).toBe('Database');
        expect(multipathReadcount.violationDetails?.[0]?.value).toBe('128');

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

        const featuresViolation = multipathConfig.violationDetails?.find(v => v.objectName === 'features');
        expect(featuresViolation?.value).toBe('2 pg_init_retries 50');
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
});
