import { describe, it, expect } from 'vitest';
import {
    canTriggerUnregisteredAssessment,
    isUnregisteredInventoryRow,
    hasPartialRunPermission,
    shouldDisableUnregisteredDatabasesAndPassword,
    shouldRestrictWellArchitectTabs,
    mergeUnregisteredAssessmentIntoInventory,
    resolveInventoryRowForAssessmentInstance
} from './InventoryUtilsV2';
import { DBType, INVENTORY_STATUS } from '../../utils/consts';

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

    it('returns false when inventory marks instance as registered with FSx link', () => {
        expect(
            shouldRestrictWellArchitectTabs({
                isWad: false,
                isUnregistered: false,
                isRegisteredInstance: true,
                fsxLinkExists: true,
                hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: true }
            })
        ).toBe(false);
    });

    it('returns true when inventory marks instance as registered without FSx link', () => {
        expect(
            shouldRestrictWellArchitectTabs({
                isWad: false,
                isUnregistered: false,
                isRegisteredInstance: true,
                fsxLinkExists: false
            })
        ).toBe(true);
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

    it('returns false for registered instances with FSx link', () => {
        expect(
            shouldDisableUnregisteredDatabasesAndPassword({
                isWad: false,
                isUnregistered: false,
                isRegisteredInstance: true,
                fsxLinkExists: true
            })
        ).toBe(false);
    });

    it('returns true for registered instances without FSx link', () => {
        expect(
            shouldDisableUnregisteredDatabasesAndPassword({
                isWad: false,
                isUnregistered: false,
                isRegisteredInstance: true,
                fsxLinkExists: false
            })
        ).toBe(true);
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

describe('mergeUnregisteredAssessmentIntoInventory', () => {
    const unregisteredAssessment = {
        vmInstanceId: 'i-25694686',
        databaseInstanceName: 'oracleasm',
        assessments: { metadata: { source: 'unregistered', lastAssessmentTimestamp: 1785488870082 } }
    };

    it('does not re-apply isUnregistered onto a registered managed instance after refresh', () => {
        const inventory = {
            host_key: {
                hostType: DBType.ORACLE,
                ec2InstanceId: 'i-25694686',
                sqlServerInstances: [
                    {
                        databaseInstanceName: 'oracleasm',
                        statusColText: INVENTORY_STATUS.MANAGED,
                        isUnregistered: false,
                        isWad: false
                    }
                ]
            }
        };

        const merged = mergeUnregisteredAssessmentIntoInventory(inventory, [unregisteredAssessment], DBType.ORACLE);

        expect(merged).toBe(inventory);
        expect(merged.host_key.sqlServerInstances[0].isUnregistered).toBe(false);
    });

    it('still merges unregistered assessment onto discover/unmanaged instances', () => {
        const inventory = {
            host_key: {
                hostType: DBType.ORACLE,
                ec2InstanceId: 'i-25694686',
                sqlServerInstances: [
                    {
                        databaseInstanceName: 'oracleasm',
                        statusColText: INVENTORY_STATUS.UNMANAGED,
                        isUnregistered: false,
                        isWad: false
                    }
                ]
            }
        };

        const merged = mergeUnregisteredAssessmentIntoInventory(inventory, [unregisteredAssessment], DBType.ORACLE);

        expect(merged).not.toBe(inventory);
        expect(merged.host_key.sqlServerInstances[0].isUnregistered).toBe(true);
        expect(merged.host_key.sqlServerInstances[0].wadAssessmentData).toBe(unregisteredAssessment.assessments);
    });

    it('merges after deregister even when stale resourceId remains on row', () => {
        const inventory = {
            host_key: {
                hostType: DBType.MSSQL,
                ec2InstanceId: 'i-ec2',
                sqlServerInstances: [
                    {
                        databaseInstanceName: 'ALLALLOWED',
                        statusColText: INVENTORY_STATUS.UNMANAGED,
                        resourceId: 'stale-res',
                        isUnregistered: false
                    }
                ]
            }
        };

        const merged = mergeUnregisteredAssessmentIntoInventory(
            inventory,
            [
                {
                    vmInstanceId: 'i-ec2',
                    databaseInstanceName: 'ALLALLOWED',
                    assessments: { metadata: { lastAssessmentTimestamp: 1, source: 'unregistered' } }
                }
            ],
            DBType.MSSQL
        );

        expect(merged.host_key.sqlServerInstances[0].wadAssessmentData).toBeDefined();
        expect(merged.host_key.sqlServerInstances[0].isUnregistered).toBe(true);
    });
});

describe('isUnregisteredInventoryRow', () => {
    it('returns false when instance is managed even if isUnregistered flag is stale', () => {
        expect(isUnregisteredInventoryRow({ isUnregistered: true, statusColText: INVENTORY_STATUS.MANAGED }, {})).toBe(
            false
        );
        expect(
            isUnregisteredInventoryRow(
                { isUnregistered: true, statusColText: INVENTORY_STATUS.UNMANAGED },
                { resourceId: 'res-1' }
            )
        ).toBe(false);
    });

    it('returns true when row is marked unregistered and not yet managed', () => {
        expect(
            isUnregisteredInventoryRow({ isUnregistered: true, statusColText: INVENTORY_STATUS.UNMANAGED }, {})
        ).toBe(true);
    });

    it('returns true for discover row with permissions and no registered resource id', () => {
        expect(
            isUnregisteredInventoryRow(
                {
                    statusColText: INVENTORY_STATUS.UNMANAGED,
                    hostManageReadiness: { extensiveRunPermission: true, canReadAWSSSMDocuments: true }
                },
                { resourceId: undefined, databaseInstanceId: 'discover-server-guid' } as any
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

describe('resolveInventoryRowForAssessmentInstance unregistered cred mismatch', () => {
    const inventoryTableData = {
        'host_selected-cred_ap-southeast-1': {
            hostType: DBType.MSSQL,
            ec2InstanceId: 'i-07a29eb681ba37679',
            credentialId: '385165a2-a194-4088-8b74-c3cb8a504a33',
            regionId: 'ap-southeast-1',
            name: 'adwlmcom',
            sqlServerInstances: [
                {
                    databaseInstanceId: 'SQLLOGIN1',
                    databaseInstanceName: 'SQLLOGIN1',
                    statusColText: INVENTORY_STATUS.UNMANAGED,
                    hostManageReadiness: { extensiveRunPermission: true }
                }
            ]
        }
    };

    const databaseHost = {
        databaseHostId: 'i-07a29eb681ba37679',
        credentialId: '92978933-14fe-4c1c-9cd0-85364b5c380f',
        regionId: 'ap-southeast-1',
        isUnregistered: true
    };

    const instance = {
        databaseInstanceId: 'SQLLOGIN1',
        databaseInstanceName: 'SQLLOGIN1',
        assessments: { metadata: { source: 'unregistered', lastAssessmentTimestamp: 1 } }
    };

    it('resolves discover inventory row when assessment credential differs', () => {
        const row = resolveInventoryRowForAssessmentInstance(databaseHost, instance, inventoryTableData);
        expect(row?.databaseInstanceName).toBe('SQLLOGIN1');
        expect(row?.credentialId).toBe('385165a2-a194-4088-8b74-c3cb8a504a33');
        expect(row?.hostName).toBe('adwlmcom');
    });
});
