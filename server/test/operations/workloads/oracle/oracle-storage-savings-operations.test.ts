import { describe, it, expect, vi, afterEach } from 'vitest';

import '../../../simulator/scopes/aws/ec2-scope';

import { DiscoverOracleResponseType } from '../../../../src/routes/types/discover.types';
import {
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG,
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE
} from '../../../../src/utils/consts';

import * as discoverOperations from '../../../../src/operations/discover-operations';
import * as marketingOps from '../../../../src/operations/cloud-manager/marketing/marketing-operations';
import * as marketingOpsUtils from '../../../../src/operations/cloud-manager/marketing/marketing-operations-utils';
import type { MarketingApiResponse } from '../../../../src/operations/cloud-manager/marketing/marketing-operations-utils';
import type { FsxCostCalculations } from '../../../../src/utils/marketing-types';
import ebsStorageSavingsCalculationFixture from '../../../simulator/responses/cloud-manager/ebs-storage-savings-calculation.json';
import * as oracleStorageSavingsModule from '../../../../src/operations/workloads/oracle/oracle-storage-savings-operations';
import {
    extractOracleEbsVolumeIdsForHost,
    getOracleAutomaticTcoComputeDeploymentTypeForHost,
    getOracleBulkStorageSavingsCalculationMetrics,
    isOracleHostIneligibleForAutomaticEbsSavings,
    partitionOracleEbsVolumesByDeploymentType,
    performOracleBulkStorageSavingsCalculations
} from '../../../../src/operations/workloads/oracle/oracle-storage-savings-operations';

type DiscoverOracleResourcesResult = Awaited<ReturnType<typeof discoverOperations.discoverOracleResources>>;

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── helpers ────────────────────────────────────────────────────────────────

function makeStorageSummary(total: number) {
    return { capacity: total, iops: 0, throughput: 0, snapshots: 0, clones: 0, total };
}

function makeFsxBlock(): FsxCostCalculations {
    const { single } = ebsStorageSavingsCalculationFixture;
    if (!single) {
        throw new Error(
            'ebs-storage-savings-calculation.json must include single FSx calculations for Oracle storage savings tests'
        );
    }
    return single as FsxCostCalculations;
}

function makeMarketingResponse(opts: {
    ebsTotal: number;
    fsxTotal: number;
    single?: boolean;
    multi?: boolean;
}): MarketingApiResponse {
    return {
        ebs: makeStorageSummary(opts.ebsTotal),
        fsx: makeStorageSummary(opts.fsxTotal),
        ...(opts.single && { single: makeFsxBlock() }),
        ...(opts.multi && { multi: makeFsxBlock() })
    };
}

function makeMetricsResponse(opts: { ebsTotal: number; fsxTotal: number }) {
    return {
        ebs: makeStorageSummary(opts.ebsTotal),
        fsx: makeStorageSummary(opts.fsxTotal),
        ebsCalculation: { gp3: {} },
        ebsCloneCalculation: { gp3: {} },
        ebsSnapshotCalculation: { gp3: {} },
        multi: {}
    };
}

function makeHost(opts: {
    ec2InstanceId: string;
    databaseInstanceDetails: Array<{
        isDataGuardDeployed?: boolean;
        isRacEnabled?: boolean;
        isInstanceStorageAsmManaged?: boolean;
        storage?: Array<{ type: string; id: string }>;
    }>;
}): DiscoverOracleResponseType {
    return {
        ec2InstanceId: opts.ec2InstanceId,
        ec2InstanceType: 'm5.large',
        databaseInstanceDetails: opts.databaseInstanceDetails
    } as DiscoverOracleResponseType;
}

// ─── isOracleHostIneligibleForAutomaticEbsSavings ───────────────────────────

describe('isOracleHostIneligibleForAutomaticEbsSavings', () => {
    it('should return true when RAC is enabled', () => {
        const host = makeHost({ ec2InstanceId: 'i-1', databaseInstanceDetails: [{ isRacEnabled: true }] });
        expect(isOracleHostIneligibleForAutomaticEbsSavings(host)).toBe(true);
    });

    it('should return true when instance storage is ASM-managed', () => {
        const host = makeHost({
            ec2InstanceId: 'i-1',
            databaseInstanceDetails: [{ isInstanceStorageAsmManaged: true }]
        });
        expect(isOracleHostIneligibleForAutomaticEbsSavings(host)).toBe(true);
    });

    it('should return false when neither RAC nor ASM-managed storage applies', () => {
        const host = makeHost({
            ec2InstanceId: 'i-1',
            databaseInstanceDetails: [{ isRacEnabled: false, isInstanceStorageAsmManaged: false }]
        });
        expect(isOracleHostIneligibleForAutomaticEbsSavings(host)).toBe(false);
    });
});

// ─── getOracleAutomaticTcoComputeDeploymentTypeForHost ───────────────────────

describe('getOracleAutomaticTcoComputeDeploymentTypeForHost', () => {
    it('should return DG when any database instance has Data Guard deployed', () => {
        const host = makeHost({ ec2InstanceId: 'i-1', databaseInstanceDetails: [{ isDataGuardDeployed: true }] });
        expect(getOracleAutomaticTcoComputeDeploymentTypeForHost(host)).toBe(ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG);
    });

    it('should return Standalone when Data Guard is not deployed', () => {
        const host = makeHost({ ec2InstanceId: 'i-1', databaseInstanceDetails: [{ isDataGuardDeployed: false }] });
        expect(getOracleAutomaticTcoComputeDeploymentTypeForHost(host)).toBe(
            ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE
        );
    });
});

// ─── extractOracleEbsVolumeIdsForHost ───────────────────────────────────────

describe('extractOracleEbsVolumeIdsForHost', () => {
    it('should collect EBS volume ids from database instance storage', () => {
        const host = makeHost({
            ec2InstanceId: 'i-1',
            databaseInstanceDetails: [
                {
                    storage: [
                        { type: 'EBS', id: 'vol-aaa' },
                        { type: 'FSX', id: 'fs-1' }
                    ]
                }
            ]
        });
        expect(extractOracleEbsVolumeIdsForHost(host)).toEqual(['vol-aaa']);
    });
});

// ─── partitionOracleEbsVolumesByDeploymentType ───────────────────────────────

describe('partitionOracleEbsVolumesByDeploymentType', () => {
    it('should route DG rows to dgEbsVolumeIds and non-DG rows to standaloneEbsVolumeIds', () => {
        const host = makeHost({
            ec2InstanceId: 'i-1',
            databaseInstanceDetails: [
                { isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-dg-1' }] },
                { isDataGuardDeployed: false, storage: [{ type: 'EBS', id: 'vol-sa-1' }] }
            ]
        });
        const result = partitionOracleEbsVolumesByDeploymentType([host]);
        expect(result.dgEbsVolumeIds).toEqual(['vol-dg-1']);
        expect(result.standaloneEbsVolumeIds).toEqual(['vol-sa-1']);
        expect(result.isMixed).toBe(true);
    });

    it('should set isMixed=false when all rows are DG', () => {
        const host = makeHost({
            ec2InstanceId: 'i-1',
            databaseInstanceDetails: [
                { isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-dg-1' }] },
                { isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-dg-2' }] }
            ]
        });
        const result = partitionOracleEbsVolumesByDeploymentType([host]);
        expect(result.isMixed).toBe(false);
        expect(result.dgEbsVolumeIds).toHaveLength(2);
        expect(result.standaloneEbsVolumeIds).toHaveLength(0);
    });

    it('should set isMixed=false when all rows are Standalone', () => {
        const host = makeHost({
            ec2InstanceId: 'i-1',
            databaseInstanceDetails: [{ isDataGuardDeployed: false, storage: [{ type: 'EBS', id: 'vol-sa-1' }] }]
        });
        const result = partitionOracleEbsVolumesByDeploymentType([host]);
        expect(result.isMixed).toBe(false);
        expect(result.dgEbsVolumeIds).toHaveLength(0);
        expect(result.standaloneEbsVolumeIds).toHaveLength(1);
    });

    it('should handle inter-host mixed bulk: one DG host, one Standalone host', () => {
        const dgHost = makeHost({
            ec2InstanceId: 'i-dg',
            databaseInstanceDetails: [{ isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-dg-1' }] }]
        });
        const saHost = makeHost({
            ec2InstanceId: 'i-sa',
            databaseInstanceDetails: [{ isDataGuardDeployed: false, storage: [{ type: 'EBS', id: 'vol-sa-1' }] }]
        });
        const result = partitionOracleEbsVolumesByDeploymentType([dgHost, saHost]);
        expect(result.isMixed).toBe(true);
        expect(result.dgEbsVolumeIds).toEqual(['vol-dg-1']);
        expect(result.standaloneEbsVolumeIds).toEqual(['vol-sa-1']);
    });

    it('should deduplicate volume ids that appear in multiple rows', () => {
        const host = makeHost({
            ec2InstanceId: 'i-1',
            databaseInstanceDetails: [
                { isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-shared' }] },
                { isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-shared' }] }
            ]
        });
        const result = partitionOracleEbsVolumesByDeploymentType([host]);
        expect(result.dgEbsVolumeIds).toEqual(['vol-shared']);
    });
});

// ─── invokeMarketingApi call count in mixed vs homogeneous paths ─────────────

describe('mixed vs homogeneous marketing API call routing', () => {
    const sharedParams = {
        snapshotFrequency: 'Daily' as const,
        clonedCopiesCount: 1,
        cloneRefreshFrequency: 'Monthly' as const,
        monthlyChangeRatePercentage: 10,
        hosts: [{ ec2InstanceId: 'i-dg' }, { ec2InstanceId: 'i-sa' }]
    };

    it('intra-host mixed: two invokeMarketingApi calls, one per partition', async () => {
        const invokeMarketingApiSpy = vi
            .spyOn(marketingOpsUtils, 'invokeMarketingApi')
            .mockResolvedValueOnce(makeMarketingResponse({ ebsTotal: 100, fsxTotal: 50, multi: true }))
            .mockResolvedValueOnce(makeMarketingResponse({ ebsTotal: 80, fsxTotal: 40, single: true }));

        vi.spyOn(marketingOps, 'handleMarketingApiFsxCalculationObject').mockReturnValue({
            totalStorageCapacity: 1000,
            deploymentType: 'Multi'
        } as ReturnType<typeof marketingOps.handleMarketingApiFsxCalculationObject>);

        const mixedHost = makeHost({
            ec2InstanceId: 'i-mixed',
            databaseInstanceDetails: [
                { isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-dg-1' }] },
                { isDataGuardDeployed: false, storage: [{ type: 'EBS', id: 'vol-sa-1' }] }
            ]
        });

        vi.spyOn(discoverOperations, 'discoverOracleResources').mockResolvedValue({
            items: [mixedHost]
        } as DiscoverOracleResourcesResult);

        vi.spyOn(oracleStorageSavingsModule, 'partitionOracleEbsVolumesByDeploymentType');

        await performOracleBulkStorageSavingsCalculations('acct', 'cred', 'us-east-1', ['i-mixed'], sharedParams);

        expect(invokeMarketingApiSpy).toHaveBeenCalledTimes(2);
        const [firstCall, secondCall] = invokeMarketingApiSpy.mock.calls;
        expect(firstCall[3]).toBe(ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG);
        expect(secondCall[3]).toBe(ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE);
    });

    it('homogeneous bulk (all DG): single invokeMarketingApi call', async () => {
        const invokeMarketingApiSpy = vi
            .spyOn(marketingOpsUtils, 'invokeMarketingApi')
            .mockResolvedValueOnce(makeMarketingResponse({ ebsTotal: 200, fsxTotal: 100, multi: true }));

        vi.spyOn(marketingOps, 'handleMarketingApiFsxCalculationObject').mockReturnValue({
            totalStorageCapacity: 1000,
            deploymentType: 'Multi'
        } as ReturnType<typeof marketingOps.handleMarketingApiFsxCalculationObject>);

        const dgHost = makeHost({
            ec2InstanceId: 'i-dg',
            databaseInstanceDetails: [{ isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-dg-1' }] }]
        });

        vi.spyOn(discoverOperations, 'discoverOracleResources').mockResolvedValue({
            items: [dgHost]
        } as DiscoverOracleResourcesResult);

        await performOracleBulkStorageSavingsCalculations('acct', 'cred', 'us-east-1', ['i-dg'], sharedParams);

        expect(invokeMarketingApiSpy).toHaveBeenCalledTimes(1);
        expect(invokeMarketingApiSpy.mock.calls[0][3]).toBe(ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG);
    });

    it('mixed: merges ebs totals from both partitions in the response', async () => {
        vi.spyOn(marketingOpsUtils, 'invokeMarketingApi')
            .mockResolvedValueOnce(makeMarketingResponse({ ebsTotal: 100, fsxTotal: 50 }))
            .mockResolvedValueOnce(makeMarketingResponse({ ebsTotal: 80, fsxTotal: 40 }));

        const mixedHost = makeHost({
            ec2InstanceId: 'i-mixed',
            databaseInstanceDetails: [
                { isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-dg-1' }] },
                { isDataGuardDeployed: false, storage: [{ type: 'EBS', id: 'vol-sa-1' }] }
            ]
        });

        vi.spyOn(discoverOperations, 'discoverOracleResources').mockResolvedValue({
            items: [mixedHost]
        } as DiscoverOracleResourcesResult);

        const result = await performOracleBulkStorageSavingsCalculations(
            'acct',
            'cred',
            'us-east-1',
            ['i-mixed'],
            sharedParams
        );

        expect(result.ebs?.total).toBe(180);
        expect(result.fsx.total).toBe(90);
    });

    it('mixed metrics: two formatStorageSavingsCalculationMetrics calls (all-volumes + standalone)', async () => {
        const formatMetricsSpy = vi
            .spyOn(marketingOps, 'formatStorageSavingsCalculationMetrics')
            .mockResolvedValueOnce(
                makeMetricsResponse({ ebsTotal: 200, fsxTotal: 100 }) as Awaited<
                    ReturnType<typeof marketingOps.formatStorageSavingsCalculationMetrics>
                >
            )
            .mockResolvedValueOnce(
                makeMetricsResponse({ ebsTotal: 80, fsxTotal: 40 }) as Awaited<
                    ReturnType<typeof marketingOps.formatStorageSavingsCalculationMetrics>
                >
            );

        const mixedHost = makeHost({
            ec2InstanceId: 'i-mixed',
            databaseInstanceDetails: [
                { isDataGuardDeployed: true, storage: [{ type: 'EBS', id: 'vol-dg-1' }] },
                { isDataGuardDeployed: false, storage: [{ type: 'EBS', id: 'vol-sa-1' }] }
            ]
        });

        vi.spyOn(discoverOperations, 'discoverOracleResources').mockResolvedValue({
            items: [mixedHost]
        } as DiscoverOracleResourcesResult);

        await getOracleBulkStorageSavingsCalculationMetrics('acct', 'cred', 'us-east-1', ['i-mixed'], sharedParams);

        expect(formatMetricsSpy).toHaveBeenCalledTimes(2);
        // Call 1: all volumes, DG type
        expect(formatMetricsSpy.mock.calls[0][3]).toEqual(expect.arrayContaining(['vol-dg-1', 'vol-sa-1']));
        expect(formatMetricsSpy.mock.calls[0][5]).toBe(ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG);
        // Call 2: standalone volumes only
        expect(formatMetricsSpy.mock.calls[1][3]).toEqual(['vol-sa-1']);
        expect(formatMetricsSpy.mock.calls[1][5]).toBe(ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE);
    });
});
