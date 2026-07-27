import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DescribeFileSystemsCommandOutput } from '@aws-sdk/client-fsx';

import { getMssqlStorageDataFromOntap } from '../../../../src/operations/workloads/mssql/mssql-operations';
import * as fsxLib from '../../../../src/lib/aws/fsx';
import {
    registerProxyGetResponse,
    resetProxyOverrides
} from '../../../simulator/scopes/cloud-manager/proxy-forwarder-scope';
import { ACCOUNT_ID, CREDENTIALS_ID, DEFAULT_AWS_REGION } from '../../../utils/consts';
import { DEFAULT_INSTANCE_NAME } from '../../../../src/utils/consts';
import type { DatabaseInstance } from '../../../../src/utils/common-types';

const FSX_FILESYSTEM_ID = 'fs-03773e21b2f0e39b4';

function mockFsxManagementEndpoint(): void {
    const resolvedValue: DescribeFileSystemsCommandOutput = {
        $metadata: {},
        FileSystems: [
            {
                FileSystemId: FSX_FILESYSTEM_ID,
                Lifecycle: 'AVAILABLE',
                OntapConfiguration: {
                    Endpoints: {
                        Management: {
                            DNSName: `management.${FSX_FILESYSTEM_ID}.fsx.${DEFAULT_AWS_REGION}.amazonaws.com`
                        }
                    }
                }
            }
        ]
    };
    vi.spyOn(fsxLib, 'describeFSx').mockResolvedValue(resolvedValue);
}

function buildManagedInstance(): DatabaseInstance[] {
    return [
        {
            database_instance_name: DEFAULT_INSTANCE_NAME,
            isManaged: true,
            fsxn_ids: FSX_FILESYSTEM_ID,
            credentials_id: CREDENTIALS_ID,
            region: DEFAULT_AWS_REGION
        }
    ] as unknown as DatabaseInstance[];
}

describe('MSSQL Operations', () => {
    afterEach(() => {
        resetProxyOverrides();
        vi.restoreAllMocks();
    });

    describe('getMssqlStorageDataFromOntap', () => {
        it('should aggregate ONTAP volume space/efficiency fields into per-instance storage savings totals', async () => {
            mockFsxManagementEndpoint();
            registerProxyGetResponse({
                targetId: FSX_FILESYSTEM_ID,
                ontapPath: 'api/storage/luns',
                body: {
                    num_records: 2,
                    records: [
                        {
                            uuid: 'lun-uuid-data',
                            name: '/vol/wlmdb_sqldata_apr1/sqldata',
                            serial_number: 'lWB5g?XW76kw'
                        },
                        { uuid: 'lun-uuid-log', name: '/vol/wlmdb_sqllog_apr1/sqllog', serial_number: 'lWB5g?XW76kx' }
                    ]
                }
            });
            registerProxyGetResponse({
                targetId: FSX_FILESYSTEM_ID,
                ontapPath: 'api/storage/volumes',
                body: {
                    num_records: 2,
                    records: [
                        {
                            uuid: 'vol-uuid-data',
                            name: 'wlmdb_sqldata_apr1',
                            space: {
                                size: 1000,
                                used: 400,
                                physical_used: 150,
                                performance_tier_footprint: 50,
                                capacity_tier_footprint: 10,
                                snapshot: { used: 5 }
                            },
                            efficiency: { space_savings: { total: 100, total_percent: 25 } }
                        },
                        {
                            uuid: 'vol-uuid-log',
                            name: 'wlmdb_sqllog_apr1',
                            space: {
                                size: 500,
                                used: 200,
                                physical_used: 80,
                                performance_tier_footprint: 20,
                                capacity_tier_footprint: 5,
                                snapshot: { used: 2 }
                            },
                            efficiency: { space_savings: { total: 40, total_percent: 20 } }
                        }
                    ]
                }
            });

            const response = await getMssqlStorageDataFromOntap(
                ACCOUNT_ID,
                'i-storage-savings-test',
                buildManagedInstance(),
                false
            );

            expect(response?.[DEFAULT_INSTANCE_NAME]).toEqual({
                size: 1500,
                used: 600,
                physicalUsed: 230,
                ssdUsed: 70,
                capacityPoolUsed: 15,
                snapshotUsed: 7,
                spaceSavings: 140
            });
        });

        it('should return zeroed storage totals when no ONTAP volumes are found for the collected LUN serials', async () => {
            mockFsxManagementEndpoint();
            registerProxyGetResponse({
                targetId: FSX_FILESYSTEM_ID,
                ontapPath: 'api/storage/luns',
                body: { num_records: 0, records: [] }
            });

            const response = await getMssqlStorageDataFromOntap(
                ACCOUNT_ID,
                'i-storage-savings-test-empty',
                buildManagedInstance(),
                false
            );

            expect(response?.[DEFAULT_INSTANCE_NAME]).toEqual({
                size: 0,
                used: 0,
                spaceSavings: 0,
                physicalUsed: 0,
                ssdUsed: 0,
                capacityPoolUsed: 0,
                snapshotUsed: 0
            });
        });
    });
});
