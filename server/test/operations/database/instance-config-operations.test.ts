import {
    createDatabaseInstanceConfigData,
    listDatabaseInstanceConfigData
} from '../../../src/lib/database/database-instance-config';
import { purgeOlderAssessmentRecords } from '../../../src/operations/database/instance-config-operations';
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
        await purgeOlderAssessmentRecords();
        const resp = await listDatabaseInstanceConfigData(ACCOUNT_ID);
        expect(resp.length).toEqual(1);
    });
});
