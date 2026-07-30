import { describe, expect, it } from 'vitest';
import {
    getFsxIdsForTooltip,
    getInstanceFsxLinkExists,
    getInstanceFsxLinksCount,
    resolveInstanceFsxLinkExists
} from './InventoryUtilsV2';

describe('getFsxIdsForTooltip', () => {
    it('dedupes FSx IDs across host instances', () => {
        const rowData = {
            hostRow: {
                sqlServerInstances: [
                    {
                        storage: [
                            { type: 'FSXN', id: 'fs-1', fileSystemName: 'fsx-a' },
                            { type: 'EBS', id: 'vol-1' }
                        ]
                    },
                    {
                        storage: [
                            { type: 'FSXN', id: 'fs-2', fileSystemName: 'fsx-b' },
                            { type: 'FSXN', id: 'fs-1', fileSystemName: 'fsx-a' }
                        ]
                    }
                ]
            },
            fsxList: [{ id: 'fs-ignored' }]
        };

        expect(getFsxIdsForTooltip(rowData).map(fsx => fsx.id)).toEqual(['fs-1', 'fs-2']);
    });

    it('falls back to row fsxList then fsxId', () => {
        expect(getFsxIdsForTooltip({ fsxList: [{ id: 'fs-row' }] }).map(fsx => fsx.id)).toEqual(['fs-row']);
        expect(getFsxIdsForTooltip({ fsxId: 'fs-single', fileSystemName: 'name' }).map(fsx => fsx.id)).toEqual([
            'fs-single'
        ]);
    });
});

describe('getInstanceFsxLinksCount', () => {
    it('prefers instance row, then topology, then hostManageReadiness', () => {
        expect(getInstanceFsxLinksCount({ fsxLinksCount: 2 })).toBe(2);
        expect(getInstanceFsxLinksCount({ databaseInstanceTopology: { fsxLinksCount: 1 } })).toBe(1);
        expect(getInstanceFsxLinksCount({ hostManageReadiness: { fsxLinksCount: 3 } })).toBe(3);
    });
});

describe('getInstanceFsxLinkExists', () => {
    it('prefers instance row, then topology, then hostManageReadiness', () => {
        expect(getInstanceFsxLinkExists({ fsxLinkExists: false })).toBe(false);
        expect(getInstanceFsxLinkExists({ databaseInstanceTopology: { fsxLinkExists: true } })).toBe(true);
        expect(getInstanceFsxLinkExists({ hostManageReadiness: { fsxLinkExists: false } })).toBe(false);
    });
});

describe('resolveInstanceFsxLinkExists', () => {
    it('reads fsxLinkExists from inventory instance topology', () => {
        expect(
            resolveInstanceFsxLinkExists({
                inventoryTableData: {
                    host_1: {
                        resourceId: 'host-1',
                        sqlServerInstances: [
                            {
                                databaseInstanceId: 'inst-1',
                                fsxLinkExists: false,
                                databaseInstanceTopology: { fsxLinkExists: false }
                            }
                        ]
                    }
                },
                resourceId: 'host-1',
                credId: 'cred',
                regionId: 'region',
                instanceId: 'inst-1'
            })
        ).toBe(false);
    });

    it('falls back to store when instance row has no fsxLinkExists signal', () => {
        expect(
            resolveInstanceFsxLinkExists({
                fsxLinkExistsFromStore: false,
                inventoryTableData: {
                    host_1: {
                        resourceId: 'host-1',
                        sqlServerInstances: [{ databaseInstanceId: 'inst-1', databaseInstanceName: 'MyInst' }]
                    }
                },
                resourceId: 'host-1',
                credId: 'cred',
                regionId: 'region',
                instanceId: 'inst-1'
            })
        ).toBe(false);
    });

    it('matches instance name case-insensitively', () => {
        expect(
            resolveInstanceFsxLinkExists({
                inventoryTableData: {
                    host_1: {
                        resourceId: 'host-1',
                        sqlServerInstances: [{ databaseInstanceName: 'case2sql', fsxLinkExists: false }]
                    }
                },
                resourceId: 'host-1',
                instanceName: 'CASE2SQL'
            })
        ).toBe(false);
    });
});
