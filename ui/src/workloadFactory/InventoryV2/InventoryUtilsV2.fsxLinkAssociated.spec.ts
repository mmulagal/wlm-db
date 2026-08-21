import { describe, expect, it } from 'vitest';
import { getInstanceFsxLinkExists, markInstanceFsxLinkExistsInInventory, uniqueHostRow } from './InventoryUtilsV2';

describe('markInstanceFsxLinkExistsInInventory', () => {
    const credId = 'cred-1';
    const regionId = 'us-east-1';
    const resourceId = 'host-resource-1';
    const hostKey = uniqueHostRow(resourceId, credId, regionId);

    const inventoryTableData = {
        [hostKey]: {
            resourceId,
            sqlServerInstances: [
                {
                    databaseInstanceId: 'inst-1',
                    databaseInstanceName: 'SQLINST',
                    databaseInstanceTopology: { fsxLinkExists: false }
                }
            ],
            hostManageReadiness: { fsxLinkExists: false }
        }
    };

    it('sets fsxLinkExists on the matched instance and host readiness', () => {
        const updated = markInstanceFsxLinkExistsInInventory(inventoryTableData, {
            resourceId,
            credId,
            regionId,
            instanceId: 'inst-1',
            instanceName: 'SQLINST'
        });

        const instance = updated?.[hostKey]?.sqlServerInstances?.[0];
        expect(getInstanceFsxLinkExists(instance)).toBe(true);
        expect(updated?.[hostKey]?.hostManageReadiness?.fsxLinkExists).toBe(true);
        expect(instance?.databaseInstanceTopology?.fsxLinkExists).toBe(true);
    });

    it('returns null when inventory is missing', () => {
        expect(
            markInstanceFsxLinkExistsInInventory(null, {
                resourceId,
                credId,
                regionId,
                instanceId: 'inst-1'
            })
        ).toBeNull();
    });
});
