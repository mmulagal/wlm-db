import { describe, it, expect } from 'vitest';
import {
    canTriggerUnregisteredAssessment,
    isUnregisteredInventoryRow,
    hasPartialRunPermission,
    shouldDisableUnregisteredDatabasesAndPassword,
    shouldRestrictWellArchitectTabs
} from './InventoryUtilsV2';
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

describe('hasPartialRunPermission', () => {
    it('returns true when canReadAWSSSMDocuments is true and extensiveRunPermission is false', () => {
        expect(
            hasPartialRunPermission({
                extensiveRunPermission: false,
                canReadAWSSSMDocuments: true
            })
        ).toBe(true);
    });

    it('returns false when extensiveRunPermission is true', () => {
        expect(
            hasPartialRunPermission({
                extensiveRunPermission: true,
                canReadAWSSSMDocuments: true
            })
        ).toBe(false);
    });

    it('returns false when canReadAWSSSMDocuments is false', () => {
        expect(
            hasPartialRunPermission({
                extensiveRunPermission: false,
                canReadAWSSSMDocuments: false
            })
        ).toBe(false);
    });
});

describe('shouldRestrictWellArchitectTabs', () => {
    it('returns true for WAD instances', () => {
        expect(shouldRestrictWellArchitectTabs({ isWad: true, isUnregistered: false })).toBe(true);
    });

    it('returns true for unregistered on-demand instances', () => {
        expect(shouldRestrictWellArchitectTabs({ isWad: false, isUnregistered: true })).toBe(true);
    });

    it('returns true when not registered and hostManageReadiness lacks extensiveRunPermission', () => {
        expect(
            shouldRestrictWellArchitectTabs({
                isWad: false,
                isUnregistered: false,
                isRegisteredInstance: false,
                hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: true }
            })
        ).toBe(true);
    });

    it('returns false for registered managed navigation without hostManageReadiness', () => {
        expect(shouldRestrictWellArchitectTabs({ isWad: false, isUnregistered: false })).toBe(false);
    });

    it('returns false when inventory marks instance as registered', () => {
        expect(
            shouldRestrictWellArchitectTabs({
                isWad: false,
                isUnregistered: false,
                isRegisteredInstance: true,
                hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: true }
            })
        ).toBe(false);
    });

    it('returns true for discover instances that are not registered', () => {
        expect(
            shouldRestrictWellArchitectTabs({
                isWad: false,
                isUnregistered: false,
                isRegisteredInstance: false
            })
        ).toBe(true);
    });
});

describe('shouldDisableUnregisteredDatabasesAndPassword', () => {
    it('returns false for WAD instances', () => {
        expect(
            shouldDisableUnregisteredDatabasesAndPassword({
                isWad: true,
                isUnregistered: true
            })
        ).toBe(false);
    });

    it('returns false for registered instances', () => {
        expect(
            shouldDisableUnregisteredDatabasesAndPassword({
                isWad: false,
                isUnregistered: false,
                isRegisteredInstance: true
            })
        ).toBe(false);
    });

    it('returns true for unregistered instances regardless of assessment permissions', () => {
        expect(
            shouldDisableUnregisteredDatabasesAndPassword({
                isWad: false,
                isUnregistered: true,
                hostManageReadiness: { extensiveRunPermission: true, canReadAWSSSMDocuments: true }
            })
        ).toBe(true);
        expect(
            shouldDisableUnregisteredDatabasesAndPassword({
                isWad: false,
                isUnregistered: true,
                hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: true }
            })
        ).toBe(true);
    });

    it('returns true for discover instances that are not registered', () => {
        expect(
            shouldDisableUnregisteredDatabasesAndPassword({
                isWad: false,
                isUnregistered: false,
                isRegisteredInstance: false
            })
        ).toBe(true);
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
