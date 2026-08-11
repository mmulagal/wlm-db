import { describe, it, expect } from 'vitest';

import { getAssessmentInstanceDedupKey, shouldSkipDuplicateAssessmentInstance } from './InventoryUtilsV2';

describe('assessment instance dedup', () => {
    it('builds ec2 + instance name key from inventory row', () => {
        expect(
            getAssessmentInstanceDedupKey(
                { databaseHostId: 'managed-1', vmInstanceId: 'i-ec2' },
                { databaseInstanceName: 'ALLALLOWED' },
                { ec2InstanceId: 'i-ec2' }
            )
        ).toBe('i-ec2_allallowed');
    });

    it('skips second credential row for the same physical instance', () => {
        const inventoryTableData = {
            host_a: {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred-a',
                regionId: 'ap-southeast-1',
                sqlServerInstances: [{ databaseInstanceName: 'ALLALLOWED', statusColText: 'Managed' }]
            },
            host_b: {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred-b',
                regionId: 'ap-southeast-1',
                sqlServerInstances: [{ databaseInstanceName: 'ALLALLOWED', statusColText: 'Managed' }]
            }
        };
        const uniqueInstanceList: string[] = [];
        const hostA = {
            databaseHostId: 'managed-a',
            vmInstanceId: 'i-ec2',
            credentialId: 'cred-a',
            regionId: 'ap-southeast-1'
        };
        const hostB = {
            databaseHostId: 'managed-b',
            vmInstanceId: 'i-ec2',
            credentialId: 'cred-b',
            regionId: 'ap-southeast-1'
        };
        const instance = { databaseInstanceName: 'ALLALLOWED' };

        expect(shouldSkipDuplicateAssessmentInstance(hostA, instance, inventoryTableData, uniqueInstanceList)).toBe(
            false
        );
        expect(shouldSkipDuplicateAssessmentInstance(hostB, instance, inventoryTableData, uniqueInstanceList)).toBe(
            true
        );
        expect(uniqueInstanceList).toEqual(['i-ec2_allallowed']);
    });

    it('keeps different instances on the same EC2', () => {
        const inventoryTableData = {
            host_a: {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred-a',
                regionId: 'ap-southeast-1',
                sqlServerInstances: [{ databaseInstanceName: 'SQLLOGIN1' }]
            },
            host_b: {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred-b',
                regionId: 'ap-southeast-1',
                sqlServerInstances: [{ databaseInstanceName: 'DOMAINLOGIN1' }]
            }
        };
        const uniqueInstanceList: string[] = [];

        expect(
            shouldSkipDuplicateAssessmentInstance(
                { databaseHostId: 'i-ec2', vmInstanceId: 'i-ec2', credentialId: 'cred-a', regionId: 'ap-southeast-1' },
                { databaseInstanceName: 'SQLLOGIN1' },
                inventoryTableData,
                uniqueInstanceList
            )
        ).toBe(false);
        expect(
            shouldSkipDuplicateAssessmentInstance(
                { databaseHostId: 'i-ec2', vmInstanceId: 'i-ec2', credentialId: 'cred-b', regionId: 'ap-southeast-1' },
                { databaseInstanceName: 'DOMAINLOGIN1' },
                inventoryTableData,
                uniqueInstanceList
            )
        ).toBe(false);
        expect(uniqueInstanceList).toHaveLength(2);
    });
});
