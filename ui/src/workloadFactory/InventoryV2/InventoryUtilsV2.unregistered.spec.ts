import { describe, it, expect } from 'vitest';
import { canTriggerUnregisteredAssessment, isUnregisteredInventoryRow } from './InventoryUtilsV2';
import { INVENTORY_STATUS } from '../../utils/consts';

describe('canTriggerUnregisteredAssessment', () => {
    it('returns true when extensiveRunPermission is true', () => {
        expect(
            canTriggerUnregisteredAssessment({
                extensiveRunPermission: true,
                canReadAWSSSMDocuments: false
            })
        ).toBe(true);
    });

    it('returns true when canReadAWSSSMDocuments is true', () => {
        expect(
            canTriggerUnregisteredAssessment({
                extensiveRunPermission: false,
                canReadAWSSSMDocuments: true
            })
        ).toBe(true);
    });

    it('returns false when neither permission is granted', () => {
        expect(
            canTriggerUnregisteredAssessment({
                extensiveRunPermission: false,
                canReadAWSSSMDocuments: false
            })
        ).toBe(false);
    });
});

describe('isUnregisteredInventoryRow', () => {
    it('returns true when row is already marked unregistered', () => {
        expect(isUnregisteredInventoryRow({ isUnregistered: true, statusColText: INVENTORY_STATUS.MANAGED }, {})).toBe(
            true
        );
    });

    it('returns true for discover row with permissions and no registered resource id', () => {
        expect(
            isUnregisteredInventoryRow(
                {
                    statusColText: INVENTORY_STATUS.UNMANAGED,
                    hostManageReadiness: { extensiveRunPermission: true, canReadAWSSSMDocuments: true }
                },
                { resourceId: undefined }
            )
        ).toBe(true);
    });

    it('returns false for managed instances even with permissions', () => {
        expect(
            isUnregisteredInventoryRow(
                {
                    statusColText: INVENTORY_STATUS.MANAGED,
                    hostManageReadiness: { extensiveRunPermission: true }
                },
                {}
            )
        ).toBe(false);
    });

    it('returns false for discover row without permissions', () => {
        expect(
            isUnregisteredInventoryRow(
                {
                    statusColText: INVENTORY_STATUS.UNMANAGED,
                    hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: false }
                },
                {}
            )
        ).toBe(false);
    });
});
