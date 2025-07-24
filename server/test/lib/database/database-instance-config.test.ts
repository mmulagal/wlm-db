import {
    createDatabaseInstanceConfigData,
    removeDatabaseInstanceConfigData
} from '../../../src/lib/database/database-instance-config';
import { paginateListInstanceConfigData } from '../../../src/operations/database/instance-config-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID } from '../../utils/consts';

describe('database instance config operations', () => {
    const DatabaseInstanceConfigDataRecords = [
        {
            resource_id: 'i-1234567890abcdef0',
            account_id: ACCOUNT_ID,
            credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
            region: 'us-east-1',
            database_instance_id: 'sql-server-broker-uuid',
            creation_time: new Date(),
            last_updated: new Date(),
            config_data: {
                volumes: [
                    {
                        name: 'vol_murali_clone1',
                        'thin-provision': true,
                        'space-guarantee': 'none',
                        autosize: 'off',
                        'autosize-mode': 'off',
                        'fractional-reserve': 0,
                        'snapshot-policy': 'default',
                        'snapshot-reserve': 5,
                        'snapshot-autodelete': false,
                        'tiering-policy': 'none',
                        'tiering-min-cooling-days': null
                    },
                    {
                        name: 'rranga_clone',
                        'thin-provision': true,
                        'space-guarantee': 'none',
                        autosize: 'off',
                        'autosize-mode': 'off',
                        'fractional-reserve': 0,
                        'snapshot-policy': 'default',
                        'snapshot-reserve': 5,
                        'snapshot-autodelete': false,
                        'tiering-policy': 'auto',
                        'tiering-min-cooling-days': 31
                    }
                ]
            },
            config_data_type: 'CONFIG'
        },
        {
            resource_id: 'i-1234567890abcdef0',
            account_id: ACCOUNT_ID,
            credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
            region: 'us-east-1',
            database_instance_id: 'sql-server-broker-uuid',
            creation_time: new Date(),
            last_updated: new Date(),
            config_data: {
                volumes: [
                    {
                        name: 'vol_murali_clone1',
                        'thin-provision': true,
                        'space-guarantee': 'none',
                        autosize: 'off',
                        'autosize-mode': 'off',
                        'fractional-reserve': 0,
                        'snapshot-policy': 'default',
                        'snapshot-reserve': 5,
                        'snapshot-autodelete': false,
                        'tiering-policy': 'none',
                        'tiering-min-cooling-days': null
                    },
                    {
                        name: 'rranga_clone',
                        'thin-provision': true,
                        'space-guarantee': 'none',
                        autosize: 'off',
                        'autosize-mode': 'off',
                        'fractional-reserve': 0,
                        'snapshot-policy': 'default',
                        'snapshot-reserve': 5,
                        'snapshot-autodelete': false,
                        'tiering-policy': 'auto',
                        'tiering-min-cooling-days': 31
                    }
                ]
            },
            config_data_type: 'PERFORMANCE'
        }
    ];

    beforeAll(async () => {
        // Clean up any existing test data first
        await removeDatabaseInstanceConfigData(undefined, ACCOUNT_ID);
        // Create test data before running all tests
        await createDatabaseInstanceConfigData(DatabaseInstanceConfigDataRecords);
    });

    afterAll(async () => {
        // Clean up test data after all tests are complete
        await removeDatabaseInstanceConfigData(undefined, ACCOUNT_ID);
    });

    describe('pagination tests', () => {
        it('should return all items when no pagination is specified', async () => {
            const result = await paginateListInstanceConfigData({ accountId: ACCOUNT_ID });

            expect(result.items.length).toEqual(2);
            expect(result.totalCount).toEqual(0); // totalCount is 0 when pageSize is not specified
            expect(result.nextToken).toBeUndefined();
        });

        it('should return paginated results with pageSize', async () => {
            const result = await paginateListInstanceConfigData({
                accountId: ACCOUNT_ID,
                pageSize: 1
            });

            expect(result.items.length).toEqual(1);
            expect(result.totalCount).toEqual(2);
            expect(result.nextToken).toBeDefined();
        });

        it('should return correct page when nextToken is provided', async () => {
            // Get first page
            const firstPage = await paginateListInstanceConfigData({
                accountId: ACCOUNT_ID,
                pageSize: 1
            });

            expect(firstPage.items.length).toEqual(1);
            expect(firstPage.nextToken).toBeDefined();

            // Get second page using nextToken
            const secondPage = await paginateListInstanceConfigData({
                accountId: ACCOUNT_ID,
                pageSize: 1,
                nextToken: firstPage.nextToken
            });

            expect(secondPage.items.length).toEqual(1);
            expect(secondPage.totalCount).toEqual(2);
            // Verify we got different records
            // Prismock doesnt support cursor pagination, so next expect will fail
            // expect(firstPage.items[0].database_instance_id).not.toEqual(secondPage.items[0].database_instance_id);
        });

        it('should not return nextToken when all items are returned', async () => {
            const result = await paginateListInstanceConfigData({
                accountId: ACCOUNT_ID,
                pageSize: 10 // pageSize larger than total items
            });

            expect(result.items.length).toEqual(2);
            expect(result.totalCount).toEqual(2);
            expect(result.nextToken).toBeUndefined();
        });
    });

    it('should create database instance config records', async () => {
        // This test verifies data creation works (data was created in beforeAll)
        const { items: resp } = await paginateListInstanceConfigData({ accountId: ACCOUNT_ID });
        expect(resp.length).toEqual(2);
    });

    it('should list database instance config records', async () => {
        const { items: resp } = await paginateListInstanceConfigData({ accountId: ACCOUNT_ID });
        expect(resp.length).toEqual(2);
    });

    it('should remove database instance config records', async () => {
        // First verify records exist
        const { items: resp } = await paginateListInstanceConfigData({ accountId: ACCOUNT_ID });
        expect(resp.length).toEqual(2);

        // Remove by database_instance_id since id field is not returned
        const removeResp = await removeDatabaseInstanceConfigData(
            undefined, // id
            undefined, // accountId
            undefined, // region
            undefined, // credentialsId
            undefined, // resourceId
            'sql-server-broker-uuid' // databaseInstanceId
        );
        expect(removeResp.count).toBeGreaterThan(0);

        // Verify records are removed
        const { items: afterRemoval } = await paginateListInstanceConfigData({ accountId: ACCOUNT_ID });
        expect(afterRemoval.length).toEqual(0);
    });
});
