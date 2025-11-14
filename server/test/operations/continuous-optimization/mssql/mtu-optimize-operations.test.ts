import {
    optimizeMTUAlignment,
    getFSxMTUValue,
    validateMTUOptimizationRequest
} from '../../../../src/operations/continuous-optimization/mssql/mtu-optimize-operations';
import { createResource, upsertDatabaseInstance } from '../../../../src/lib/database/db';
import { ACCOUNT_ID, DEFAULT_AWS_REGION, DEFAULT_AWS_CREDENTIALS_ID } from '../../../utils/consts';

describe('MTU optimization', () => {
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

    const accountId = ACCOUNT_ID;
    const credentialsId = DEFAULT_AWS_CREDENTIALS_ID;
    const region = DEFAULT_AWS_REGION;
    const databaseHostId = RESOURCE_ID;
    const instanceId = ACTIVE_NODE_INSTANCE_ID;
    const targetMTU = 9001;
    const interfaceNames = ['Ethernet 3'];

    it('optimizeMTUAlignment: should optimize MTU for single interface', async () => {
        const result = await optimizeMTUAlignment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceId,
            targetMTU,
            interfaceNames
        );
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(Array.isArray(result.optimizedInterfaces)).toBe(true);
        if (result.optimizedInterfaces.length > 0) {
            expect(result.optimizedInterfaces[0]).toHaveProperty('name');
            expect(result.optimizedInterfaces[0]).toHaveProperty('status');
            expect(result.optimizedInterfaces[0]).toHaveProperty('jumboValue');
        }
    });

    it('optimizeMTUAlignment: should optimize MTU for multiple interfaces', async () => {
        const multipleInterfaces = ['Ethernet 3', 'Ethernet 4', 'Local Area Connection 2'];
        const result = await optimizeMTUAlignment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceId,
            targetMTU,
            multipleInterfaces
        );
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(Array.isArray(result.optimizedInterfaces)).toBe(true);
    });

    it('optimizeMTUAlignment: should handle empty interface array', async () => {
        const result = await optimizeMTUAlignment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceId,
            targetMTU,
            []
        );
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(Array.isArray(result.optimizedInterfaces)).toBe(true);
    });

    it('optimizeMTUAlignment: should handle different MTU values', async () => {
        const result = await optimizeMTUAlignment(
            accountId,
            credentialsId,
            region,
            databaseHostId,
            instanceId,
            9000, // Different MTU value
            interfaceNames
        );
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(Array.isArray(result.optimizedInterfaces)).toBe(true);
    });

    it('getFSxMTUValue: should return a valid MTU value', async () => {
        const instanceRecord = {
            id: DATABASE_INSTANCE_ID,
            name: 'test-instance',
            type: 'MSSQL' as const,
            fsxFileSystem: 'fs-0f53fbecdd3d85fb2',
            region,
            sqlAuthEnabled: false,
            activeNodeInstanceid: instanceId,
            resourceName: 'test-mtu-resource'
        };
        const mtu = await getFSxMTUValue(credentialsId, region, instanceRecord, accountId);
        expect(mtu).toBeDefined();
        expect(typeof mtu).toBe('number');
        expect(mtu).toBeGreaterThan(0);
        expect(mtu).toBeLessThanOrEqual(9016);
    });

    it('getFSxMTUValue: should handle different FSx file systems', async () => {
        const instanceRecord = {
            id: DATABASE_INSTANCE_ID,
            name: 'test-instance-2',
            type: 'MSSQL' as const,
            fsxFileSystem: 'fs-0a1b2c3d4e5f6g7h8',
            region,
            sqlAuthEnabled: false,
            activeNodeInstanceid: instanceId,
            resourceName: 'test-mtu-resource-2'
        };
        const mtu = await getFSxMTUValue(credentialsId, region, instanceRecord, accountId);
        expect(mtu).toBeDefined();
        expect(typeof mtu).toBe('number');
        expect(mtu).toBeGreaterThan(0);
        expect(mtu).toBeLessThanOrEqual(9016);
    });

    it('validateMTUOptimizationRequest: should validate a correct request', async () => {
        const validRequest = {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId: DATABASE_INSTANCE_ID,
            interfaces: [{ interfaceName: 'Ethernet 3' }]
        };
        const result = await validateMTUOptimizationRequest(validRequest);
        expect(result).toBe(true);
    });

    it('validateMTUOptimizationRequest: should validate request with multiple interfaces', async () => {
        const validRequest = {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId: DATABASE_INSTANCE_ID,
            interfaces: [{ interfaceName: 'Ethernet 3' }, { interfaceName: 'Ethernet 4' }, { interfaceName: 'Wi-Fi' }]
        };
        const result = await validateMTUOptimizationRequest(validRequest);
        expect(result).toBe(true);
    });

    it('validateMTUOptimizationRequest: should validate request with parentJobId', async () => {
        const validRequest = {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId: DATABASE_INSTANCE_ID,
            interfaces: [{ interfaceName: 'Ethernet 3' }],
            parentJobId: 'parent-job-123'
        };
        const result = await validateMTUOptimizationRequest(validRequest);
        expect(result).toBe(true);
    });

    // Negative test cases
    it('validateMTUOptimizationRequest: should throw error for missing accountId', async () => {
        const invalidRequest = {
            accountId: '',
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId: DATABASE_INSTANCE_ID,
            interfaces: [{ interfaceName: 'Ethernet 3' }]
        };
        await expect(validateMTUOptimizationRequest(invalidRequest)).rejects.toThrow(
            'Missing required parameters for MTU optimization'
        );
    });

    it('validateMTUOptimizationRequest: should throw error for missing credentialsId', async () => {
        const invalidRequest = {
            accountId,
            credentialsId: '',
            region,
            databaseHostId,
            databaseInstanceId: DATABASE_INSTANCE_ID,
            interfaces: [{ interfaceName: 'Ethernet 3' }]
        };
        await expect(validateMTUOptimizationRequest(invalidRequest)).rejects.toThrow(
            'Missing required parameters for MTU optimization'
        );
    });

    it('validateMTUOptimizationRequest: should throw error for empty interfaces array', async () => {
        const invalidRequest = {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId: DATABASE_INSTANCE_ID,
            interfaces: []
        };
        await expect(validateMTUOptimizationRequest(invalidRequest)).rejects.toThrow(
            'No interfaces specified for MTU optimization'
        );
    });

    it('validateMTUOptimizationRequest: should throw error for invalid interface name', async () => {
        const invalidRequest = {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId: DATABASE_INSTANCE_ID,
            interfaces: [{ interfaceName: '' }]
        };
        await expect(validateMTUOptimizationRequest(invalidRequest)).rejects.toThrow('Invalid interface name:');
    });

    it('validateMTUOptimizationRequest: should throw error for whitespace-only interface name', async () => {
        const invalidRequest = {
            accountId,
            credentialsId,
            region,
            databaseHostId,
            databaseInstanceId: DATABASE_INSTANCE_ID,
            interfaces: [{ interfaceName: '   ' }]
        };
        await expect(validateMTUOptimizationRequest(invalidRequest)).rejects.toThrow('Invalid interface name:');
    });
});
