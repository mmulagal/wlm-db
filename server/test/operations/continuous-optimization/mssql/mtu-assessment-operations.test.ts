import {
    calculateMTUAlignmentDrift,
    assessMTUAlignment
} from '../../../../src/operations/continuous-optimization/mssql/mtu-assessment-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { createResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { AssessmentStatus } from '../../../../src/utils/continous-optimization-consts';

const RESOURCE_ID = '6cbdabbfe3fb147e';
const DATABASE_INSTANCE_ID = 'f4b7c5d3-e1f6-4g2a-9b5d';
const ACTIVE_NODE_INSTANCE_ID = 'i-07e76a4b916548dc0';

beforeAll(async () => {
    await createResource(ACCOUNT_ID, {
        resourceId: RESOURCE_ID,
        resourceName: 'test-mtu-resource',
        resourceType: 'MSSQL',
        coRelationId: 'fs-f6082f35c1db',
        cloudProviderAccountId: 'test-aws-account',
        cloudProviderName: 'AWS',
        region: DEFAULT_AWS_REGION,
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        storageType: 'FSXN',
        metadata: {
            node1InstanceId: ACTIVE_NODE_INSTANCE_ID,
            node2InstanceId: 'i-0880a21327284f67c',
            sqlDeploymentType: 'FCI'
        }
    });

    await upsertDatabaseInstance(ACCOUNT_ID, {
        credentialsId: DEFAULT_AWS_CREDENTIALS_ID,
        region: DEFAULT_AWS_REGION,
        resourceId: RESOURCE_ID,
        databaseInstanceId: DATABASE_INSTANCE_ID,
        databaseInstanceName: 'MSSQLSERVER',
        isDefault: true,
        source: 'deployment',
        sqlDeploymentType: 'FCI',
        fsxSvmId: { 'fs-0f53fbecdd3d85fb2': 'svm-0123456789abcdef0' },
        fsxnIds: 'fs-0f53fbecdd3d85fb2',
        databaseType: 'MSSQL'
    });
});

describe('calculateMTUAlignmentDrift', () => {
    const metadata = {
        node1InstanceId: ACTIVE_NODE_INSTANCE_ID,
        node2InstanceId: 'i-0880a21327284f67c',
        sqlDeploymentType: 'FCI'
    };

    it('should calculate drift when MTU values are misaligned', () => {
        const assessmentData = {
            mtuAlignment: {
                sqlServerMTU: {
                    sqlInterfaces: [
                        {
                            name: 'Ethernet 3',
                            mtu: 1500,
                            interfaceIndex: 9,
                            ports: ['1433'],
                            ipAddresses: [{ address: '172.31.32.100', family: 'IPv4' }]
                        },
                        {
                            name: 'Ethernet 4',
                            mtu: 9001,
                            interfaceIndex: 10,
                            ports: ['1434'],
                            ipAddresses: [{ address: '172.31.32.101', family: 'IPv4' }]
                        }
                    ],
                    error: null
                },
                fsxMTU: {
                    fsxInterfaces: [
                        { Name: 'e0a', MTU: 9001 },
                        { Name: 'e0b', MTU: 9001 }
                    ],
                    error: null
                }
            }
        };

        const result = calculateMTUAlignmentDrift(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            metadata,
            assessmentData
        );

        // Type guard to ensure result is not an error item
        expect(result).not.toHaveProperty('errorMessage');
        if ('errorMessage' in result) {
            throw new Error('Expected assessment item, got error item');
        }

        expect(result.status).toBe(AssessmentStatus.NOT_OPTIMIZED);
        expect(result.objectsInViolation).toEqual(['Ethernet 3']); // Only Ethernet 3 has misaligned MTU
        expect(result.totalObjectsAssessed).toBe(2);
        expect(result.totalObjectsInViolation).toBe(1);
        expect(result.ec2InterfacesToFix).toHaveLength(1);
        expect(result.ec2InterfacesToFix?.[0]).toEqual({
            ec2InstanceId: ACTIVE_NODE_INSTANCE_ID,
            name: 'Ethernet 3',
            currentMTU: 1500,
            recommendedMTU: 9001,
            interfaceIndex: 9
        });
    });

    it('should return optimized status when all MTU values are aligned', () => {
        const assessmentData = {
            mtuAlignment: {
                sqlServerMTU: {
                    sqlInterfaces: [
                        {
                            name: 'Ethernet 3',
                            mtu: 9001,
                            interfaceIndex: 9,
                            ports: ['1433'],
                            ipAddresses: [{ address: '172.31.32.100', family: 'IPv4' }]
                        },
                        {
                            name: 'Ethernet 4',
                            mtu: 9001,
                            interfaceIndex: 10,
                            ports: ['1434'],
                            ipAddresses: [{ address: '172.31.32.101', family: 'IPv4' }]
                        }
                    ],
                    error: null
                },
                fsxMTU: {
                    fsxInterfaces: [
                        { Name: 'e0a', MTU: 9001 },
                        { Name: 'e0b', MTU: 9001 }
                    ],
                    error: null
                }
            }
        };

        const result = calculateMTUAlignmentDrift(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            metadata,
            assessmentData
        );

        // Type guard to ensure result is not an error item
        expect(result).not.toHaveProperty('errorMessage');
        if ('errorMessage' in result) {
            throw new Error('Expected assessment item, got error item');
        }

        expect(result.status).toBe(AssessmentStatus.OPTIMIZED);
        expect(result.objectsInViolation).toEqual([]);
        expect(result.totalObjectsAssessed).toBe(2);
        expect(result.totalObjectsInViolation).toBe(0);
        expect(result.ec2InterfacesToFix).toHaveLength(0);
    });
});

describe('assessMTUAlignment', () => {
    const metadata = {
        node1InstanceId: ACTIVE_NODE_INSTANCE_ID,
        node2InstanceId: 'i-0880a21327284f67c',
        sqlDeploymentType: 'FCI'
    };
    const parentJobId = 'test-parent-job-id';
    const resourceName = 'test-mtu-resource';

    it('should successfully assess MTU alignment and return data', async () => {
        const result = await assessMTUAlignment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            RESOURCE_ID,
            ACTIVE_NODE_INSTANCE_ID,
            DATABASE_INSTANCE_ID,
            parentJobId,
            metadata,
            resourceName
        );

        expect(result).toHaveProperty('mtuAlignmentAssessment');
        expect(result.mtuAlignmentAssessment).toHaveProperty('sqlServerMTU');
        expect(result.mtuAlignmentAssessment).toHaveProperty('fsxMTU');

        // Verify SQL Server MTU data structure based on our mock
        expect(result.mtuAlignmentAssessment.sqlServerMTU).toHaveProperty('sqlInterfaces');
        expect(Array.isArray(result.mtuAlignmentAssessment.sqlServerMTU.sqlInterfaces)).toBe(true);
        expect(result.mtuAlignmentAssessment.sqlServerMTU.sqlInterfaces).toHaveLength(2);

        // Verify FSx MTU data structure based on our mock
        expect(result.mtuAlignmentAssessment.fsxMTU).toHaveProperty('fsxInterfaces');
        expect(Array.isArray(result.mtuAlignmentAssessment.fsxMTU.fsxInterfaces)).toBe(true);
        expect(result.mtuAlignmentAssessment.fsxMTU.fsxInterfaces).toHaveLength(2);

        // Verify no error occurred
        expect(result.errorMessage).toBeUndefined();
    });

    it('should handle errors and return error message when assessment fails', async () => {
        // Use invalid resource ID to trigger error
        const invalidResourceId = 'invalid-resource-id';

        const result = await assessMTUAlignment(
            ACCOUNT_ID,
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            invalidResourceId,
            ACTIVE_NODE_INSTANCE_ID,
            DATABASE_INSTANCE_ID,
            parentJobId,
            metadata,
            resourceName
        );

        expect(result).toHaveProperty('errorMessage');
        expect(result.errorMessage).toContain('Error while performing mtu alignment assessment');
        expect(result.mtuAlignmentAssessment).toBeUndefined();
    });
});
