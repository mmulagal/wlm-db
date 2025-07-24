import {
    createDatabaseInstanceConfigData,
    deleteAllButLatestRecordPerConfigDataType
} from '../../../src/lib/database/database-instance-config';
import { paginateListInstanceConfigData } from '../../../src/operations/database/instance-config-operations';
import { ACCOUNT_ID, DEFAULT_AWS_CREDENTIALS_ID } from '../../utils/consts';

describe('database instance config operations', () => {
    it('should remove all but latest database instance config records', async () => {
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
                config_data_type: 'STORAGE'
            },
            {
                resource_id: 'i-1234567890abcdef0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                database_instance_id: 'sql-server-broker-uuid',
                creation_time: new Date(Date.now() + 5 * 60 * 1000),
                last_updated: new Date(Date.now() + 5 * 60 * 1000),
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
                config_data_type: 'STORAGE'
            }
        ];
        await createDatabaseInstanceConfigData(DatabaseInstanceConfigDataRecords);
        await deleteAllButLatestRecordPerConfigDataType();
        const { items: resp } = await paginateListInstanceConfigData({ accountId: ACCOUNT_ID });
        expect(resp.length).toBeDefined(); // Need to check this
    });

    it('should list database instance config data - mapped ontap volumes', async () => {
        const DatabaseInstanceConfigDataRecords = [
            {
                resource_id: 'i-1234567890abcdef0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                database_instance_id: 'sql-server-broker-uuid',
                creation_time: new Date(Date.now() + 5 * 60 * 1000),
                last_updated: new Date(Date.now() + 5 * 60 * 1000),
                config_data: {
                    MSSQLSERVER: {
                        volumeRecords: [
                            {
                                id: 'fsvol-07acdf92ec5a46901',
                                name: 'wlmdb_sqllog_1735879485',
                                ontapUuid: '7b76a5bc-c98d-11ef-b315-11b9ce95d982'
                            },
                            {
                                id: 'fsvol-047e94678e1ac3833',
                                name: 'wlmdb_sqldata_1733316163306',
                                ontapUuid: 'c0caa491-b23f-11ef-a881-1fbfd81226d0'
                            }
                        ]
                    }
                },
                config_data_type: 'MAPPED_ONTAP_VOLUMES'
            },
            {
                resource_id: 'i-1234567890abcdef0',
                account_id: ACCOUNT_ID,
                credentials_id: DEFAULT_AWS_CREDENTIALS_ID,
                region: 'us-east-1',
                database_instance_id: 'sql-server-broker-uuid',
                creation_time: new Date(Date.now() + 5 * 60 * 1000),
                last_updated: new Date(Date.now() + 5 * 60 * 1000),
                config_data: {
                    MSSQLSERVER: {
                        volumeRecords: [
                            {
                                fsxVolumeId: 'fsvol-04eceff808fb10bbd',
                                name: 'wlmdb_sqllog_1733316163306',
                                uuid: 'c6b00780-b23f-11ef-a881-1fbfd81226d0'
                            },
                            {
                                id: 'fsvol-04a9f0ce5c84427d2',
                                name: 'wlmdb_sqldata_1733983686_clone_1735813949',
                                ontapUuid: 'e23bf7f0-c8f4-11ef-b315-11b9ce95d982'
                            }
                        ]
                    }
                },
                config_data_type: 'MAPPED_ONTAP_VOLUMES'
            }
        ];

        await createDatabaseInstanceConfigData(DatabaseInstanceConfigDataRecords);

        const resp = await paginateListInstanceConfigData({
            accountId: ACCOUNT_ID,
            configDataType: 'MAPPED_ONTAP_VOLUMES',
            pageSize: 1,
            filters: {
                config_data: {
                    not: {}
                }
            }
        });
        expect(resp.items.length).toEqual(1);
        expect(resp.nextToken).toBeDefined();
    });
});
