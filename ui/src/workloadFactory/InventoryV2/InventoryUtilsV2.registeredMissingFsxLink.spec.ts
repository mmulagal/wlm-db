import { describe, it, expect } from 'vitest';
import { isRegisteredInstanceMissingFsxLink, isRegisteredInstanceMissingFsxLinkFromRow } from './InventoryUtilsV2';
import { INVENTORY_STATUS } from '../../utils/consts';

describe('isRegisteredInstanceMissingFsxLink', () => {
    it('returns true for registered managed instances when fsxLinkExists is false', () => {
        expect(
            isRegisteredInstanceMissingFsxLink(undefined, {
                statusColText: INVENTORY_STATUS.MANAGED,
                fsxLinkExists: false
            })
        ).toBe(true);
    });

    it('returns false for registered instances when fsxLinkExists is true', () => {
        expect(
            isRegisteredInstanceMissingFsxLink(undefined, {
                statusColText: INVENTORY_STATUS.MANAGED,
                databaseInstanceTopology: { fsxLinkExists: true }
            })
        ).toBe(false);
    });

    it('returns false for unregistered instances even when fsxLinkExists is false', () => {
        expect(
            isRegisteredInstanceMissingFsxLink(undefined, {
                statusColText: INVENTORY_STATUS.UNMANAGED,
                fsxLinkExists: false
            })
        ).toBe(false);
    });

    it('does not treat host resourceId alone as registered', () => {
        expect(
            isRegisteredInstanceMissingFsxLink(
                { resourceId: 'host-ec2-id', managementStatus: INVENTORY_STATUS.UNMANAGED },
                { statusColText: INVENTORY_STATUS.UNMANAGED, fsxLinkExists: false }
            )
        ).toBe(false);
    });

    it('returns true when host is registered and instance fsxLinkExists is false', () => {
        expect(
            isRegisteredInstanceMissingFsxLink(
                { managementStatus: INVENTORY_STATUS.REGISTERED },
                { fsxLinkExists: false }
            )
        ).toBe(true);
    });
});

describe('isRegisteredInstanceMissingFsxLinkFromRow', () => {
    it('reads fsxLinkExists from database table instanceRow when host is registered', () => {
        expect(
            isRegisteredInstanceMissingFsxLinkFromRow({
                hostRow: { managementStatus: INVENTORY_STATUS.REGISTERED },
                instanceRow: { fsxLinkExists: false }
            })
        ).toBe(true);
    });

    it('does not gate when only row resourceId is set but host is not registered', () => {
        expect(
            isRegisteredInstanceMissingFsxLinkFromRow({
                resourceId: 'host-ec2-id',
                hostRow: { resourceId: 'host-ec2-id', managementStatus: INVENTORY_STATUS.UNMANAGED },
                instanceRow: { fsxLinkExists: false }
            })
        ).toBe(false);
    });
});
