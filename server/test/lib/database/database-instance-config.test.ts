import { createHostConfigData, listHostConfigData, removeHostConfigData } from '../../../src/lib/database/database-instance-config';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID } from '../../utils/consts';

describe('Host config data operations', () => {
    it('should create Host config data records', async () => {
        const hostConfigDataRecords = [
            {
                resource_id: 'i-1234567890abcdef0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                database_instance_id: 'sql-server-broker-uuid',
                timestamp: new Date(),
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
                timestamp: new Date(),
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
        const resp = await createHostConfigData(hostConfigDataRecords);
        expect(resp.count).toEqual(2);
        await removeHostConfigData(undefined, ACCOUNT_ID);
    });

    it('should list Host config data records', async () => {
        const hostConfigDataRecords = [
            {
                resource_id: 'i-1234567890abcdef0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                database_instance_id: 'sql-server-broker-uuid',
                timestamp: new Date(),
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
                timestamp: new Date(),
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
        await createHostConfigData(hostConfigDataRecords);
        const resp = await listHostConfigData(ACCOUNT_ID);
        expect(resp.length).toEqual(2);
        await removeHostConfigData(undefined, ACCOUNT_ID);
    });

    it('should remove Host config data records', async () => {
        const hostConfigDataRecords = [
            {
                resource_id: 'i-1234567890abcdef0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                database_instance_id: 'sql-server-broker-uuid',
                timestamp: new Date(),
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
                timestamp: new Date(),
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
        await createHostConfigData(hostConfigDataRecords);
        const resp = await listHostConfigData(ACCOUNT_ID);
        const configIds = resp.map(config => config.id);
        const removeResp = await removeHostConfigData(configIds);
        expect(removeResp.count).toBeGreaterThan(1);
    });
});
