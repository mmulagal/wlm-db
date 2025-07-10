import {
    createDatabaseInstanceConfigData,
    removeDatabaseInstanceConfigData
} from '../../../src/lib/database/database-instance-config';
import { listInstanceConfigIncludingResourceAndInstance } from '../../../src/operations/database/instance-config-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID } from '../../utils/consts';

describe('database instance config operations', () => {
    it('should create database instance config records', async () => {
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
        const resp = await createDatabaseInstanceConfigData(DatabaseInstanceConfigDataRecords);
        expect(resp.count).toEqual(2);
        await removeDatabaseInstanceConfigData(undefined, ACCOUNT_ID);
    });

    it('should list database instance config records', async () => {
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
        await createDatabaseInstanceConfigData(DatabaseInstanceConfigDataRecords);
        const resp = await listInstanceConfigIncludingResourceAndInstance({ accountId: ACCOUNT_ID });
        expect(resp.length).toEqual(2);
        await removeDatabaseInstanceConfigData(undefined, ACCOUNT_ID);
    });

    it('should remove database instance config records', async () => {
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
        await createDatabaseInstanceConfigData(DatabaseInstanceConfigDataRecords);
        const resp = await listInstanceConfigIncludingResourceAndInstance({ accountId: ACCOUNT_ID });
        const configIds = resp.map(config => config.id);
        const removeResp = await removeDatabaseInstanceConfigData(configIds);
        expect(removeResp.count).toBeGreaterThan(1);
    });
});
