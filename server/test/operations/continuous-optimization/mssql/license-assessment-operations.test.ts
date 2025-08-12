import { createResource, listResources, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import '../../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../../simulator/scopes/aws/fsx-scope';
import '../../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../../simulator/scopes/opentelemetry-scope';
import '../../../simulator/scopes/aws/ssm-scope';
import '../../../simulator/scopes/aws/ec2-scope';
import '../../../simulator/scopes/aws/cloud-watch-scope';
import '../../../simulator/scopes/aws/compute-optimizer-scope';
import {
    calculateLicenseDrift,
    managedHostsLicenseAssessment
} from '../../../../src/operations/continuous-optimization/mssql/license-assessment-operations';
import { ResourceAssessmentData } from '../../../../src/utils/common-types';

const RESOURCE_ID = '6cbdabbfe3fb147e';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: '6cbdabbfe3fb147e',
        resourceName: 'test-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: 'i-07e76a4b916548dc0',
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI'
        },
        assessmentData: {
            license: {
                licenseFinding: 'OPTIMIZED',
                sqlServerInstances: [
                    {
                        nodeIps: ['172.31.41.12', '172.31.6.12'],
                        storage: [
                            {
                                id: 'fs-07a22f282fd4f5a20',
                                type: 'FSXN',
                                svmId: 'svm-05507971c4f713ba4',
                                protocol: 'iSCSI',
                                fileSystemStorageType: 'SSD'
                            }
                        ],
                        serverGuid: 'DEDC70ED-97C6-4DA3-91B8-F150E97DD40D',
                        databaseCount: '4',
                        sqlServerName: 'MEGASQL',
                        sqlServerNodes: ['sqlnode1-44317', 'sqlnode2-44317'],
                        sqlServerState: 'Running',
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['eu-south-2a', 'eu-south-2c']
                            }
                        ],
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerVersion: '15.0.2000.5',
                        windowsOsVersion: 'Microsoft Windows Server 2022',
                        isDefaultInstance: false,
                        sqlServerInstance: 'MEGASQL',
                        windowsClusterName: 'WLMWSFC-44317',
                        windowsClusterNodes: [
                            {
                                Node: 'sqlnode1-44317',
                                Address: '172.31.41.12'
                            },
                            {
                                Node: 'sqlnode2-44317',
                                Address: '172.31.6.12'
                            }
                        ],
                        sqlServerProductYear: 2019,
                        missingSqlPermissions: [],
                        windowsAuthentication: true,
                        sqlServerEngineEdition: 2,
                        sqlServerAuthentication: false,
                        sqlServerDeploymentType: 'FCI'
                    },
                    {
                        nodeIps: ['172.31.41.12', '172.31.6.12'],
                        storage: [
                            {
                                id: 'fs-07a22f282fd4f5a20',
                                type: 'FSXN',
                                svmId: 'svm-05507971c4f713ba4',
                                protocol: 'iSCSI',
                                fileSystemStorageType: 'SSD'
                            }
                        ],
                        serverGuid: '8C3CD553-6ACA-4285-A5C6-31D2464E13CA',
                        databaseCount: '16',
                        sqlServerName: 'SQLDATABASEZOID',
                        sqlServerNodes: ['sqlnode1-44317', 'sqlnode2-44317'],
                        sqlServerState: 'Running',
                        deploymentTypes: [
                            {
                                type: 'MULTI_AZ_1',
                                zones: ['eu-south-2a', 'eu-south-2c']
                            }
                        ],
                        sqlServerEdition: 'Standard Edition (64-bit)',
                        sqlServerVersion: '15.0.4298.1',
                        windowsOsVersion: 'Microsoft Windows Server 2022',
                        isDefaultInstance: true,
                        sqlServerInstance: 'MSSQLSERVER',
                        windowsClusterName: 'WLMWSFC-44317',
                        windowsClusterNodes: [
                            {
                                Node: 'sqlnode1-44317',
                                Address: '172.31.41.12'
                            },
                            {
                                Node: 'sqlnode2-44317',
                                Address: '172.31.6.12'
                            }
                        ],
                        sqlServerProductYear: 2019,
                        missingSqlPermissions: [],
                        windowsAuthentication: true,
                        sqlServerEngineEdition: 2,
                        sqlServerAuthentication: false,
                        sqlServerDeploymentType: 'FCI'
                    }
                ],
                recommendedLicenseType: 'SQL std'
            }
        }
    });

    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: RESOURCE_ID,
        databaseInstanceId: 'f4b7c5d3-e1f6-4g2a-9b5d',
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: '' // Add the missing property 'databaseType'
    });
});
describe('License assessment operations', () => {
    it('Should calculate license drift', async () => {
        const [{ assessment_data: assessmentData }] =
            (await listResources({
                accountId: ACCOUNT_ID,
                resourceId: RESOURCE_ID,
                credentialIds: DEFAULT_AWS_CREDENTIALS_ID,
                region: DEFAULT_AWS_REGION,
                selectKeys: ['assessment_data']
            })) || [];
        const response = await calculateLicenseDrift(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            'f4b7c5d3-e1f6-4g2a-9b5d',
            assessmentData as unknown as ResourceAssessmentData
        );

        expect(response.name).toEqual('sql-license');
    });

    it('Should perform license assessment for managed hosts', async () => {
        const { licenseAssessment } = await managedHostsLicenseAssessment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            'i-07e76a4b916548dc0',
            'test-resource',
            'test-job-id'
        );
        expect(licenseAssessment?.licenseFinding).toBeDefined();
    });
});
