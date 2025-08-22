import { faker } from '@faker-js/faker';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import '../../simulator/scopes/aws/cloud-watch-scope';
import '../../simulator/scopes/aws/fsx-scope';
import '../../simulator/scopes/opentelemetry-scope';
import {
    calculateFsxnStorageEfficiencyUsingCloudwatch,
    calculateFsxwStorageEfficiencyUsingCloudwatch,
    getSqlInstanceUtilizationAndPerformance
} from '../../../src/operations/aws/cloud-watch-operations';
import { DEFAULT_AWS_REGION } from '../../utils/consts';

describe('Cloud watch operations', () => {
    it('Calculate FSXn storage efficiency', async () => {
        const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
        const resp = await calculateFsxnStorageEfficiencyUsingCloudwatch(
            DEFAULT_AWS_REGION,
            CREDENTIALS_ID,
            'fs-1234567890abcdef0'
        );
        expect(resp).toBeDefined();
    });

    it('Calculate FSXw storage efficiency', async () => {
        const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
        const resp = await calculateFsxwStorageEfficiencyUsingCloudwatch(
            DEFAULT_AWS_REGION,
            CREDENTIALS_ID,
            'fs-1234567890abcdef0'
        );
        expect(resp).toBeDefined();
    });
});

describe('getSqlInstanceUtilizationAndPerformance', () => {
    const accountId = '123456789012';
    const region = 'us-west-2';
    const credentialsId = 'cred-abc';
    const databaseHostId = 'host-xyz';
    const databaseInstances = ['db1', 'db2'];

    it('should return formatted performance metrics data for each instance', async () => {
        const result = await getSqlInstanceUtilizationAndPerformance(
            accountId,
            region,
            credentialsId,
            databaseHostId,
            databaseInstances as any
        );
        expect(result).toBeDefined();
        expect(Object.keys(result)).toEqual(['db1', 'db2']);
        for (const dbName of ['db1', 'db2']) {
            expect(result[dbName]).toHaveProperty('cpuUsed');
            expect(result[dbName]).toHaveProperty('readIops');
            expect(result[dbName].cpuUsed[0]).toMatchObject({
                value: 48,
                unit: 'Percent'
            });
            expect(result[dbName].readIops[0]).toMatchObject({
                value: 180,
                unit: 'IOPS'
            });
        }
    });
});
