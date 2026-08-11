import { describe, it, expect } from 'vitest';
import { DETECT_HOST_VAR, INVENTORY_STATUS, WELL_ARCH_ASSESSMENT_FLOW } from '../../utils/consts';
import {
    isEligibleUnregisteredForWellArch,
    resolveRegisteredAssessmentHostId,
    resolveWellArchAssessmentFlow,
    shouldSkipWellArchAssessmentItem
} from './InventoryUtilsV2';

describe('isEligibleUnregisteredForWellArch', () => {
    const eligibleReadiness = { extensiveRunPermission: true, canReadAWSSSMDocuments: true };

    it('returns true for unregistered row with extensive permission', () => {
        expect(
            isEligibleUnregisteredForWellArch({
                statusColText: INVENTORY_STATUS.UNMANAGED,
                hostManageReadiness: eligibleReadiness
            })
        ).toBe(true);
    });

    it('returns true for ssmDoc-only permission', () => {
        expect(
            isEligibleUnregisteredForWellArch({
                statusColText: INVENTORY_STATUS.UNMANAGED,
                hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: true }
            })
        ).toBe(true);
    });

    it('excludes WAD rows', () => {
        expect(
            isEligibleUnregisteredForWellArch({
                isWad: true,
                hostManageReadiness: eligibleReadiness
            })
        ).toBe(false);
    });

    it('excludes registered rows', () => {
        expect(
            isEligibleUnregisteredForWellArch({
                resourceId: 'res-1',
                hostManageReadiness: eligibleReadiness
            })
        ).toBe(false);
    });

    it('excludes missing FSx link', () => {
        expect(
            isEligibleUnregisteredForWellArch({
                hostManageReadiness: { ...eligibleReadiness, fsxLinkExists: false }
            })
        ).toBe(false);
    });

    it('excludes storage not identified', () => {
        expect(
            isEligibleUnregisteredForWellArch({
                detectOption: DETECT_HOST_VAR.DISABLE,
                detectOptionDisableMsg: 'Storage could not be identified',
                hostManageReadiness: eligibleReadiness
            })
        ).toBe(false);
    });
});

describe('resolveWellArchAssessmentFlow', () => {
    it('returns wad for one-time assessment rows', () => {
        expect(resolveWellArchAssessmentFlow({ rowData: { isWad: true } })).toBe(WELL_ARCH_ASSESSMENT_FLOW.WAD);
    });

    it('returns registered when inventory instance is managed', () => {
        const inventoryTableData = {
            host1_cred_region: {
                resourceId: 'host-1',
                credentialId: 'cred',
                regionId: 'region',
                ec2InstanceId: 'i-123',
                sqlServerInstances: [
                    {
                        databaseInstanceId: 'inst-1',
                        databaseInstanceName: 'MSSQLSERVER',
                        statusColText: INVENTORY_STATUS.MANAGED,
                        resourceId: 'res-1'
                    }
                ]
            }
        };
        expect(
            resolveWellArchAssessmentFlow({
                rowData: { isUnregistered: true },
                inventoryTableData,
                resourceId: 'host-1',
                credId: 'cred',
                regionId: 'region',
                instanceId: 'inst-1'
            })
        ).toBe(WELL_ARCH_ASSESSMENT_FLOW.REGISTERED);
    });
});

describe('shouldSkipWellArchAssessmentItem', () => {
    it('includes eligible unregistered assessments when inventory row qualifies', () => {
        const inventoryTableData = {
            'i-ec2_cred_region': {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred',
                regionId: 'region',
                hostType: 'MSSQL',
                sqlServerInstances: [
                    {
                        databaseInstanceId: 'inst',
                        databaseInstanceName: 'MSSQLSERVER',
                        statusColText: 'Unmanaged',
                        hostManageReadiness: { extensiveRunPermission: true }
                    }
                ]
            }
        };
        const databaseHost = { databaseHostId: 'i-ec2', credentialId: 'cred', regionId: 'region' };
        const instance = {
            databaseInstanceId: 'inst',
            databaseInstanceName: 'MSSQLSERVER',
            assessments: { metadata: { source: 'unregistered' } }
        };
        expect(shouldSkipWellArchAssessmentItem(instance, databaseHost, inventoryTableData)).toBe(false);
    });

    it('includes registered on-demand assessments from inner page', () => {
        const inventoryTableData = {
            host1_cred_region: {
                id: 'host-1',
                credentialId: 'cred',
                regionId: 'region',
                sqlServerInstances: [
                    {
                        databaseInstanceId: 'inst-1',
                        databaseInstanceName: 'MSSQLSERVER',
                        statusColText: INVENTORY_STATUS.MANAGED,
                        resourceId: 'res-1'
                    }
                ]
            }
        };
        const databaseHost = { databaseHostId: 'host-1', credentialId: 'cred', regionId: 'region' };
        const instance = {
            databaseInstanceId: 'inst-1',
            databaseInstanceName: 'MSSQLSERVER',
            assessments: { metadata: { lastAssessmentTimestamp: 1 } }
        };
        expect(shouldSkipWellArchAssessmentItem(instance, databaseHost, inventoryTableData)).toBe(false);
    });

    it('includes unregistered when bulk assessment exists for discover row without wadAssessmentData merge', () => {
        const inventoryTableData = {
            'i-ec2_cred_region': {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred',
                regionId: 'region',
                hostType: 'MSSQL',
                sqlServerInstances: [
                    {
                        databaseInstanceId: 'DOMAINLOGIN1',
                        databaseInstanceName: 'DOMAINLOGIN1',
                        statusColText: INVENTORY_STATUS.UNMANAGED,
                        hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: false }
                    }
                ]
            }
        };
        const databaseHost = {
            databaseHostId: 'i-ec2',
            credentialId: 'cred',
            regionId: 'region',
            isUnregistered: true
        };
        const instance = {
            databaseInstanceId: 'DOMAINLOGIN1',
            databaseInstanceName: 'DOMAINLOGIN1',
            assessments: { metadata: { source: 'unregistered', lastAssessmentTimestamp: 1 } }
        };
        expect(shouldSkipWellArchAssessmentItem(instance, databaseHost, inventoryTableData)).toBe(false);
    });

    it('includes unregistered row when inventory already has merged wadAssessmentData', () => {
        const inventoryTableData = {
            'i-ec2_cred_region': {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred',
                regionId: 'region',
                hostType: 'MSSQL',
                sqlServerInstances: [
                    {
                        databaseInstanceId: 'DOMAINLOGIN1',
                        databaseInstanceName: 'DOMAINLOGIN1',
                        statusColText: INVENTORY_STATUS.UNMANAGED,
                        isUnregistered: true,
                        wadAssessmentData: { metadata: { source: 'unregistered', lastAssessmentTimestamp: 1 } },
                        hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: false }
                    }
                ]
            }
        };
        const databaseHost = {
            databaseHostId: 'i-ec2',
            credentialId: 'cred',
            regionId: 'region',
            isUnregistered: true
        };
        const instance = {
            databaseInstanceId: 'DOMAINLOGIN1',
            databaseInstanceName: 'DOMAINLOGIN1',
            assessments: { metadata: { source: 'unregistered', lastAssessmentTimestamp: 1 } }
        };
        expect(shouldSkipWellArchAssessmentItem(instance, databaseHost, inventoryTableData)).toBe(false);
    });

    it('includes discover row when only inventory wadAssessmentData exists without isUnregistered flag', () => {
        const inventoryTableData = {
            'i-ec2_cred_region': {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred',
                regionId: 'region',
                sqlServerInstances: [
                    {
                        databaseInstanceId: 'DOMAINLOGIN1',
                        databaseInstanceName: 'DOMAINLOGIN1',
                        statusColText: INVENTORY_STATUS.UNMANAGED,
                        wadAssessmentData: { metadata: { source: 'unregistered', lastAssessmentTimestamp: 1 } }
                    }
                ]
            }
        };
        const databaseHost = {
            databaseHostId: 'i-ec2',
            credentialId: 'cred',
            regionId: 'region',
            isUnregistered: true
        };
        const instance = {
            databaseInstanceId: 'DOMAINLOGIN1',
            databaseInstanceName: 'DOMAINLOGIN1',
            assessments: { metadata: { source: 'unregistered' } }
        };
        expect(shouldSkipWellArchAssessmentItem(instance, databaseHost, inventoryTableData)).toBe(false);
    });

    it('skips registered bulk assessment after deregister', () => {
        const inventoryTableData = {
            'i-ec2_cred_region': {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred',
                regionId: 'region',
                sqlServerInstances: [
                    {
                        databaseInstanceId: 'ALLALLOWED',
                        databaseInstanceName: 'ALLALLOWED',
                        statusColText: INVENTORY_STATUS.UNMANAGED
                    }
                ]
            }
        };
        const databaseHost = {
            databaseHostId: 'managed-host',
            vmInstanceId: 'i-ec2',
            credentialId: 'cred',
            regionId: 'region',
            isUnregistered: false,
            isWad: false
        };
        const instance = {
            databaseInstanceId: 'guid-1',
            databaseInstanceName: 'ALLALLOWED',
            assessments: { metadata: { lastAssessmentTimestamp: 1 } }
        };
        expect(shouldSkipWellArchAssessmentItem(instance, databaseHost, inventoryTableData)).toBe(true);
    });

    it('skips unregistered when inventory row lacks permission', () => {
        const inventoryTableData = {
            'i-ec2_cred_region': {
                ec2InstanceId: 'i-ec2',
                credentialId: 'cred',
                regionId: 'region',
                sqlServerInstances: [
                    {
                        databaseInstanceId: 'inst',
                        databaseInstanceName: 'MSSQLSERVER',
                        statusColText: 'Unmanaged',
                        hostManageReadiness: { extensiveRunPermission: false, canReadAWSSSMDocuments: false }
                    }
                ]
            }
        };
        const databaseHost = { databaseHostId: 'i-ec2', credentialId: 'cred', regionId: 'region' };
        const instance = {
            databaseInstanceId: 'inst',
            databaseInstanceName: 'MSSQLSERVER',
            assessments: { metadata: { source: 'unregistered' } }
        };
        expect(shouldSkipWellArchAssessmentItem(instance, databaseHost, inventoryTableData)).toBe(true);
    });
});

describe('resolveRegisteredAssessmentHostId', () => {
    it('returns managed instance resourceId when bulk store has ec2 id', () => {
        const inventoryTableData = {
            'managed-host_cred_region': {
                id: 'discover-host-id',
                ec2InstanceId: 'i-07a29eb681ba37679',
                credentialId: 'cred',
                regionId: 'region',
                sqlServerInstances: [
                    {
                        databaseInstanceId: 'inst-1',
                        databaseInstanceName: 'MSSQLSERVER',
                        resourceId: 'b4684a50b73111b0',
                        statusColText: INVENTORY_STATUS.MANAGED
                    }
                ]
            }
        };
        expect(
            resolveRegisteredAssessmentHostId({
                inventoryTableData,
                databaseHostId: 'i-07a29eb681ba37679',
                credentialId: 'cred',
                regionId: 'region',
                instanceId: 'inst-1'
            })
        ).toBe('b4684a50b73111b0');
    });
});
