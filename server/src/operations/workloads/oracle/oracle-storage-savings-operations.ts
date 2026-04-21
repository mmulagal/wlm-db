import createError from 'http-errors';
import { compact, isEmpty, uniq } from 'lodash-es';
import { _InstanceType } from '@aws-sdk/client-ec2';
import {
    AutomaticModeStorageSavingsMarketingParams,
    BulkStorageSavingsCalculationsMetricsResponseType,
    BulkStorageSavingsResponseType,
    ComputeLicenseCostType,
    OracleBulkStorageSavingsRequestBodyType
} from '../../../routes/types/storage-savings.types';
import { DiscoverOracleResponseType } from '../../../routes/types/discover.types';
import { NodeDetails } from '../../../utils/common-types';
import {
    FileSystemTypes,
    FINDING,
    HOURS_IN_MONTH,
    HttpErrorCodes,
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG,
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE,
    STANDALONE
} from '../../../utils/consts';
import getLogger from '../../../utils/logger';
import { StorageSummary } from '../../../utils/marketing-types';
import {
    coerceBooleanFromLooseTrue,
    fsxStorageCapacityBreakdown,
    getMonthlyPriceFromHourlyPrice
} from '../../../utils/utils';
import { getOracleInstanceRecommendations } from '../../aws/compute-optimizer-operations';
import { getSqlInstancePricingDetails } from '../../aws/pricing-operations';
import {
    formatStorageSavingsCalculationMetrics,
    handleMarketingApiFsxCalculationObject
} from '../../cloud-manager/marketing/marketing-operations';
import { invokeMarketingApi } from '../../cloud-manager/marketing/marketing-operations-utils';
import { discoverOracleResources } from '../../discover-operations';
import { checkComputeOptimizerEnrollmentStatus } from '../../recommendation-operations';
import { getExistingAndRecommendedComputeAndLicense, settledFulfilledValues } from '../../storage-savings-operations';

const logger = getLogger();

type OracleEbsVolumePartition = {
    dgEbsVolumeIds: string[];
    standaloneEbsVolumeIds: string[];
    isMixed: boolean;
};

type OracleBulkStorageSavingsResolvedContext = {
    oracleHosts: DiscoverOracleResponseType[];
    ebsVolumeIds: string[];
    dgEbsVolumeIds: string[];
    standaloneEbsVolumeIds: string[];
    isMixed: boolean;
    /** DG-wins deployment type: DG if any DG volumes exist, otherwise Standalone. Used for homogeneous paths
     *  and as the combined-all-volumes deployment type in the mixed metrics call. */
    deploymentType: typeof ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG | typeof ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE;
    marketingParams: AutomaticModeStorageSavingsMarketingParams;
};

// fsxStorageCapacityBreakdown uses the SQL Server deployment vocabulary ('standalone' vs anything else)
// to decide whether to include a quorum volume. Map Oracle deployment types accordingly.
function toFsxBreakdownDeploymentMode(
    oracleDeploymentType: typeof ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG | typeof ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE
): string {
    return oracleDeploymentType === ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE ? STANDALONE : oracleDeploymentType;
}

/**
 * Partitions Oracle EBS volume ids by `databaseInstanceDetails` row—not by host-level
 * `oracleServerDeploymentType` (which is hardcoded `Standalone` in discovery regardless of Data Guard).
 * Rows where `isDataGuardDeployed` is truthy → DG bucket; all others → Standalone bucket.
 */
function partitionOracleEbsVolumesByDeploymentType(hosts: DiscoverOracleResponseType[]): OracleEbsVolumePartition {
    const dgIds: string[] = [];
    const standaloneIds: string[] = [];
    hosts.forEach(host =>
        host.databaseInstanceDetails?.forEach(db => {
            const ebsIds = compact(db.storage?.filter(s => s.type === FileSystemTypes.EBS).map(s => s.id) ?? []);
            const bucket = db.isDataGuardDeployed ? dgIds : standaloneIds;
            ebsIds.forEach(id => bucket.push(id));
        })
    );
    const dgEbsVolumeIds = uniq(dgIds);
    const standaloneEbsVolumeIds = uniq(standaloneIds);
    return {
        dgEbsVolumeIds,
        standaloneEbsVolumeIds,
        isMixed: dgEbsVolumeIds.length > 0 && standaloneEbsVolumeIds.length > 0
    };
}

function extractOracleEbsVolumeIdsForHost(host: DiscoverOracleResponseType): string[] {
    return compact(
        host.databaseInstanceDetails?.flatMap(db =>
            db.storage?.filter(s => s.type === FileSystemTypes.EBS).map(s => s.id)
        ) ?? []
    );
}

/** True when this host must not run automatic Oracle-on-EBS TCO (RAC or ASM-managed storage). */
function isOracleHostIneligibleForAutomaticEbsSavings(host: DiscoverOracleResponseType): boolean {
    return Boolean(
        host.databaseInstanceDetails?.some(
            db =>
                coerceBooleanFromLooseTrue(db.isRacEnabled) ||
                coerceBooleanFromLooseTrue(db.isInstanceStorageAsmManaged)
        )
    );
}

function getOracleAutomaticTcoComputeDeploymentTypeForHost(
    host: DiscoverOracleResponseType
): typeof ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG | typeof ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE {
    return host.databaseInstanceDetails?.some(db => Boolean(db.isDataGuardDeployed))
        ? ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG
        : ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE;
}

function assertOracleHostsEligibleForEbsSavings(
    accountId: string,
    oracleHosts: DiscoverOracleResponseType[],
    instanceIds: string[]
) {
    if (
        oracleHosts.some(host => host.databaseInstanceDetails?.some(db => coerceBooleanFromLooseTrue(db.isRacEnabled)))
    ) {
        const errorMessage = 'Oracle RAC deployments are not supported for automatic EBS storage savings calculations.';
        logger.error(errorMessage, { accountId, instanceIds });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }
    if (
        oracleHosts.some(host =>
            host.databaseInstanceDetails?.some(db => coerceBooleanFromLooseTrue(db.isInstanceStorageAsmManaged))
        )
    ) {
        const errorMessage =
            'Oracle ASM-managed storage is not supported for automatic EBS storage savings calculations.';
        logger.error(errorMessage, { accountId, instanceIds });
        throw createError(HttpErrorCodes.BAD_REQUEST, errorMessage);
    }
}

function sumStorageSummaries(left: StorageSummary, right: StorageSummary): StorageSummary {
    return {
        capacity: left.capacity + right.capacity,
        iops: left.iops + right.iops,
        throughput: left.throughput + right.throughput,
        snapshots: left.snapshots + right.snapshots,
        clones: (left.clones ?? 0) + (right.clones ?? 0),
        total: left.total + right.total
    };
}

async function getLinuxInstanceHourlyPrice(region: string, instanceType: string): Promise<number> {
    if (!instanceType) {
        return 0;
    }
    const pricingMap = await getSqlInstancePricingDetails(region, instanceType as _InstanceType, 'Linux');
    const row = pricingMap?.[instanceType]?.NA;
    return row?.pricePerUnit ?? 0;
}

function buildOracleLinuxMachineDetails(instanceType: string, hourlyPrice: number) {
    const monthlyPrice = getMonthlyPriceFromHourlyPrice(hourlyPrice);
    return [
        {
            instanceType,
            price: hourlyPrice,
            basePrice: hourlyPrice,
            computeMonthlyPrice: monthlyPrice,
            instanceMonthlyPrice: monthlyPrice,
            hoursInMonth: HOURS_IN_MONTH
        }
    ];
}

/** Same semantics as `...(value ? { [key]: value } : {})` for optional `NodeDetails` fields. */
function spreadIfTruthy<K extends keyof NodeDetails>(
    key: K,
    value: NodeDetails[K] | null | undefined | ''
): Partial<Pick<NodeDetails, K>> {
    return value ? ({ [key]: value } as Partial<Pick<NodeDetails, K>>) : {};
}

/**
 * Oracle automatic EBS storage savings: compute list pricing uses Compute Optimizer when available
 * (prerequisite instance-type allowlists use CloudWatch utilization in `ec2-operations`). On any failure
 * in that path we keep the discovered EC2 instance type as the recommendation and classify the finding like
 * MSSQL automatic EBS (`handleInstanceRecommendation` → `getExistingAsRecommended`)—we do not invent an
 * alternate instance type from local heuristics.
 *
 * Compute Optimizer recommends one EC2 shape per host, so the CO `deploymentType` uses DG-wins (if any
 * `databaseInstanceDetails` row on the host is DG → host type = DG). EBS volume partitioning into
 * DG/Standalone buckets for the marketing API is separate and handled at the bulk level.
 */
async function retrieveOracleComputeCost(
    accountId: string,
    credentialsId: string,
    region: string,
    oracleHost: DiscoverOracleResponseType
): Promise<ComputeLicenseCostType> {
    const { ec2InstanceId, ec2InstanceType, ec2HostName } = oracleHost;

    const deploymentType = getOracleAutomaticTcoComputeDeploymentTypeForHost(oracleHost);
    const ebsVolumeIds = extractOracleEbsVolumeIdsForHost(oracleHost);
    const nodeInstances: NodeDetails[] = [
        {
            ec2InstanceId,
            ec2InstanceType,
            ...spreadIfTruthy('ec2InstancePrivateIpAddress', oracleHost.ec2InstancePrivateIpAddress),
            ...spreadIfTruthy('ec2InstanceName', oracleHost.ec2InstanceName),
            ...spreadIfTruthy('ec2UsageOperation', oracleHost.ec2UsageOperation),
            ...spreadIfTruthy('ec2InstancePrivateDnsName', oracleHost.ec2HostName)
        }
    ];

    let recommendedInstanceType = ec2InstanceType;
    let computeFinding: string = FINDING.OPTIMIZED;
    let recommendationOptions: Array<{ instanceType?: string; pricingDetails?: unknown }> = [];
    let computeMessage: string | undefined;

    // Happy path: CO (+ CW-backed allowlist in ec2-operations). Catch below mirrors MSSQL EBS behavior on errors.
    try {
        await checkComputeOptimizerEnrollmentStatus(accountId, credentialsId, region);
        const co = await getOracleInstanceRecommendations(
            region,
            credentialsId,
            accountId,
            ec2InstanceId,
            nodeInstances,
            ebsVolumeIds,
            deploymentType
        );
        computeFinding = co.finding;
        if (co.finding === FINDING.NOT_OPTIMIZED && co.instanceRecommendations?.length) {
            const [{ instanceType: coType = '' } = {}] = co.instanceRecommendations;
            recommendedInstanceType = coType || ec2InstanceType;
            recommendationOptions = co.instanceRecommendations;
        } else {
            recommendedInstanceType = ec2InstanceType;
            computeMessage = co.message;
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Align with MSSQL automatic EBS: no substitute recommendation without CO—keep current type and expose why.
        logger.warn('Oracle compute cost: Compute Optimizer path failed; keeping existing instance type', {
            accountId,
            credentialsId,
            region,
            ec2InstanceId,
            errorMessage,
            err: error
        });
        recommendedInstanceType = ec2InstanceType;
        recommendationOptions = [];
        computeFinding = FINDING.INSUFFICIENT_DATA;
        if (
            errorMessage.includes('Compute Optimizer is not enabled for the account') ||
            errorMessage.includes('not authorized')
        ) {
            computeFinding = FINDING.INSUFFICIENT_PERMISSIONS;
        } else if (errorMessage.includes('Rate exceeded') || errorMessage.includes('ThrottlingException')) {
            logger.warn('AWS Compute Optimizer rate limit exceeded when getting Oracle recommendations', {
                accountId,
                region,
                ec2InstanceId,
                errorMessage,
                err: error
            });
            computeFinding = FINDING.INSUFFICIENT_DATA;
        }
        computeMessage = errorMessage;
    }

    const [existingHourlyPrice, recommendedHourlyPrice] = await Promise.all([
        getLinuxInstanceHourlyPrice(region, ec2InstanceType),
        getLinuxInstanceHourlyPrice(region, recommendedInstanceType)
    ]);

    return {
        ec2InstanceId,
        ec2InstanceType,
        deploymentType,
        hostname: ec2HostName || ec2InstanceId,
        compute: {
            existing: {
                instanceType: ec2InstanceType,
                finding: computeFinding,
                computeHourlyPrice: existingHourlyPrice,
                computeMonthlyPrice: getMonthlyPriceFromHourlyPrice(existingHourlyPrice),
                instanceMonthlyPrice: getMonthlyPriceFromHourlyPrice(existingHourlyPrice),
                hoursInMonth: HOURS_IN_MONTH,
                machineDetails: buildOracleLinuxMachineDetails(ec2InstanceType, existingHourlyPrice)
            },
            recommended: {
                instanceType: recommendedInstanceType,
                computeHourlyPrice: recommendedHourlyPrice,
                computeMonthlyPrice: getMonthlyPriceFromHourlyPrice(recommendedHourlyPrice),
                instanceMonthlyPrice: getMonthlyPriceFromHourlyPrice(recommendedHourlyPrice),
                hoursInMonth: HOURS_IN_MONTH,
                message: computeMessage,
                machineDetails: buildOracleLinuxMachineDetails(recommendedInstanceType, recommendedHourlyPrice),
                recommendationOptions
            }
        },
        license: {
            existing: { hoursInMonth: HOURS_IN_MONTH },
            recommended: { hoursInMonth: HOURS_IN_MONTH }
        }
    };
}

function resolveOracleHostsInRequestOrder(
    instanceIds: string[],
    discoveredItems: DiscoverOracleResponseType[]
): DiscoverOracleResponseType[] {
    const byId = new Map(discoveredItems.map(host => [host.ec2InstanceId, host]));
    return compact(instanceIds.map(id => byId.get(id)));
}

async function resolveOracleBulkStorageSavingsContext(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceIds: string[],
    params: OracleBulkStorageSavingsRequestBodyType
): Promise<OracleBulkStorageSavingsResolvedContext> {
    const { items } = await discoverOracleResources(
        accountId,
        credentialsId,
        region,
        undefined,
        undefined,
        instanceIds
    );
    const oracleHosts = resolveOracleHostsInRequestOrder(instanceIds, items);

    if (isEmpty(oracleHosts)) {
        const errorMessage = `No discovered Oracle hosts found for instances: ${instanceIds.join(', ')}`;
        logger.error(errorMessage, { accountId, credentialsId, region, instanceIds });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    assertOracleHostsEligibleForEbsSavings(accountId, oracleHosts, instanceIds);

    const { dgEbsVolumeIds, standaloneEbsVolumeIds, isMixed } = partitionOracleEbsVolumesByDeploymentType(oracleHosts);
    const ebsVolumeIds = uniq([...dgEbsVolumeIds, ...standaloneEbsVolumeIds]);
    if (!ebsVolumeIds.length) {
        const errorMessage = `No EBS volumes found for the provided instance: ${instanceIds.join(', ')}`;
        logger.error(errorMessage, { accountId, credentialsId, region, instanceIds });
        throw createError(HttpErrorCodes.NOT_FOUND, errorMessage);
    }

    const deploymentType =
        dgEbsVolumeIds.length > 0 ? ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG : ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE;

    const { snapshotFrequency, clonedCopiesCount, cloneRefreshFrequency, monthlyChangeRatePercentage } = params;
    const marketingParams: AutomaticModeStorageSavingsMarketingParams = {
        snapshotFrequency,
        clonedCopiesCount,
        cloneRefreshFrequency,
        monthlyChangeRatePercentage
    };
    return {
        oracleHosts,
        ebsVolumeIds,
        dgEbsVolumeIds,
        standaloneEbsVolumeIds,
        isMixed,
        deploymentType,
        marketingParams
    };
}

async function mixOfDgAndStandaloneOracleBulkStorageSavingsCalculations(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceIds: string[],
    oracleHosts: DiscoverOracleResponseType[],
    dgEbsVolumeIds: string[],
    standaloneEbsVolumeIds: string[],
    marketingParams: AutomaticModeStorageSavingsMarketingParams
): Promise<BulkStorageSavingsResponseType> {
    logger.info('Oracle bulk EBS storage savings: mixed Data Guard / Standalone partitions', {
        accountId,
        credentialsId,
        region,
        instanceIds,
        dgVolumeCount: dgEbsVolumeIds.length,
        standaloneVolumeCount: standaloneEbsVolumeIds.length
    });

    // DG volumes → Multi FSx block; Standalone volumes → Single FSx block. Parallel with compute.
    const [computeSettledResults, dgMarketing, saMarketing] = await Promise.all([
        Promise.allSettled(oracleHosts.map(host => retrieveOracleComputeCost(accountId, credentialsId, region, host))),
        invokeMarketingApi(
            accountId,
            credentialsId,
            region,
            ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG,
            dgEbsVolumeIds,
            marketingParams,
            instanceIds
        ),
        invokeMarketingApi(
            accountId,
            credentialsId,
            region,
            ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE,
            standaloneEbsVolumeIds,
            marketingParams,
            instanceIds
        )
    ]);
    const computeAndLicenseCostList = settledFulfilledValues(computeSettledResults);
    const { existingComputeLicensePrice, recommendedComputeLicensePrice } =
        getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList);

    const dgFsx = dgMarketing.fsx as StorageSummary | undefined;
    const saFsx = saMarketing.fsx as StorageSummary | undefined;
    const mergedEbs =
        dgMarketing.ebs && saMarketing.ebs
            ? sumStorageSummaries(dgMarketing.ebs, saMarketing.ebs)
            : dgMarketing.ebs ?? saMarketing.ebs;
    const mergedFsx =
        dgFsx && saFsx
            ? sumStorageSummaries(dgFsx, saFsx)
            : dgFsx ?? saFsx ?? { capacity: 0, iops: 0, throughput: 0, snapshots: 0, clones: 0, total: 0 };

    const multiFsxData = dgMarketing.multi?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(
              dgMarketing.multi.fsx_calculation,
              dgMarketing.multi.fsx_cost_calculation_no_snapshot
          )
        : undefined;
    const singleFsxData = saMarketing.single?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(
              saMarketing.single.fsx_calculation,
              saMarketing.single.fsx_cost_calculation_no_snapshot
          )
        : undefined;
    const fsxOptimizedSingleData = saMarketing.fsxOptimizedSingle?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(
              saMarketing.fsxOptimizedSingle.fsx_calculation,
              saMarketing.fsxOptimizedSingle.fsx_cost_calculation_no_snapshot
          )
        : undefined;

    return {
        compute: computeAndLicenseCostList.map(item => ({
            ...item.compute,
            deploymentType: item.deploymentType,
            hostname: item.hostname
        })),
        license: [],
        ebs: mergedEbs,
        fsx: mergedFsx,
        totalSummary: {
            existing: Number(mergedEbs?.total || 0) + existingComputeLicensePrice,
            recommended: mergedFsx.total + recommendedComputeLicensePrice
        },
        ...(singleFsxData && {
            single: {
                fsxCalculation: singleFsxData,
                fsxBreakdown: fsxStorageCapacityBreakdown(singleFsxData.totalStorageCapacity, STANDALONE)
            }
        }),
        ...(multiFsxData && {
            multi: {
                fsxCalculation: multiFsxData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    multiFsxData.totalStorageCapacity,
                    toFsxBreakdownDeploymentMode(ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG)
                )
            }
        }),
        ...(fsxOptimizedSingleData && {
            fsxOptimizedSingle: {
                fsxCalculation: fsxOptimizedSingleData,
                fsxBreakdown: fsxStorageCapacityBreakdown(fsxOptimizedSingleData.totalStorageCapacity, STANDALONE)
            }
        })
    };
}

async function performOracleBulkStorageSavingsCalculations(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceIds: string[],
    params: OracleBulkStorageSavingsRequestBodyType
): Promise<BulkStorageSavingsResponseType> {
    logger.info('Performing Oracle bulk EBS storage savings calculations', {
        accountId,
        credentialsId,
        region,
        instanceIds
    });

    const {
        oracleHosts,
        ebsVolumeIds,
        dgEbsVolumeIds,
        standaloneEbsVolumeIds,
        isMixed,
        deploymentType,
        marketingParams
    } = await resolveOracleBulkStorageSavingsContext(accountId, credentialsId, region, instanceIds, params);

    if (isMixed) {
        return mixOfDgAndStandaloneOracleBulkStorageSavingsCalculations(
            accountId,
            credentialsId,
            region,
            instanceIds,
            oracleHosts,
            dgEbsVolumeIds,
            standaloneEbsVolumeIds,
            marketingParams
        );
    }

    const computeSettledPromise = Promise.allSettled(
        oracleHosts.map(host => retrieveOracleComputeCost(accountId, credentialsId, region, host))
    );
    // Oracle `DG` | `Standalone` → marketing API Multi/Single (same parameter as SQL Server deployment labels).
    const marketingPromise = invokeMarketingApi(
        accountId,
        credentialsId,
        region,
        deploymentType,
        ebsVolumeIds,
        marketingParams,
        instanceIds
    );

    const [computeSettledResults, { ebs, fsx, single, multi, fsxOptimizedSingle, fsxOptimized }] = await Promise.all([
        computeSettledPromise,
        marketingPromise
    ]);
    const computeAndLicenseCostList = settledFulfilledValues(computeSettledResults);
    const { existingComputeLicensePrice, recommendedComputeLicensePrice } =
        getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList);

    const singleFsxCalculationData = single?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(single.fsx_calculation, single.fsx_cost_calculation_no_snapshot)
        : undefined;
    const multiFsxCalculationData = multi?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(multi.fsx_calculation, multi.fsx_cost_calculation_no_snapshot)
        : undefined;
    const fsxOptimizedSingleFsxCalculationData = fsxOptimizedSingle?.fsx_calculation
        ? handleMarketingApiFsxCalculationObject(
              fsxOptimizedSingle.fsx_calculation,
              fsxOptimizedSingle.fsx_cost_calculation_no_snapshot
          )
        : undefined;

    return {
        compute: computeAndLicenseCostList.map(item => ({
            ...item.compute,
            deploymentType: item.deploymentType,
            hostname: item.hostname
        })),
        license: [],
        ebs,
        fsx,
        ...(fsxOptimized && { fsxOptimized }),
        totalSummary: {
            existing: Number(ebs?.total || 0) + existingComputeLicensePrice,
            recommended: fsx.total + recommendedComputeLicensePrice,
            ...(fsxOptimized && {
                optimized: (fsxOptimized as StorageSummary).total + recommendedComputeLicensePrice
            })
        },
        ...(singleFsxCalculationData && {
            single: {
                fsxCalculation: singleFsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    singleFsxCalculationData.totalStorageCapacity,
                    toFsxBreakdownDeploymentMode(deploymentType)
                )
            }
        }),
        ...(multiFsxCalculationData && {
            multi: {
                fsxCalculation: multiFsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    multiFsxCalculationData.totalStorageCapacity,
                    toFsxBreakdownDeploymentMode(deploymentType)
                )
            }
        }),
        ...(fsxOptimizedSingleFsxCalculationData && {
            fsxOptimizedSingle: {
                fsxCalculation: fsxOptimizedSingleFsxCalculationData,
                fsxBreakdown: fsxStorageCapacityBreakdown(
                    fsxOptimizedSingleFsxCalculationData.totalStorageCapacity,
                    toFsxBreakdownDeploymentMode(deploymentType)
                )
            }
        })
    };
}

async function getOracleBulkStorageSavingsCalculationMetrics(
    accountId: string,
    credentialsId: string,
    region: string,
    instanceIds: string[],
    params: OracleBulkStorageSavingsRequestBodyType
): Promise<BulkStorageSavingsCalculationsMetricsResponseType> {
    logger.info('Getting Oracle bulk EBS storage savings calculation metrics', {
        accountId,
        credentialsId,
        region,
        instanceIds
    });

    const { oracleHosts, ebsVolumeIds, standaloneEbsVolumeIds, isMixed, deploymentType, marketingParams } =
        await resolveOracleBulkStorageSavingsContext(accountId, credentialsId, region, instanceIds, params);

    const computeSettledPromise = Promise.allSettled(
        oracleHosts.map(host => retrieveOracleComputeCost(accountId, credentialsId, region, host))
    );

    if (isMixed) {
        logger.info('Oracle bulk EBS storage savings metrics: mixed Data Guard / Standalone partitions', {
            accountId,
            credentialsId,
            region,
            instanceIds,
            standaloneVolumeCount: standaloneEbsVolumeIds.length
        });

        // Mirror MSSQL mixed metrics pattern:
        // Call 1 — all volumes under deploymentType (DG-wins): EBS cost data + multi FSx block.
        // Call 2 — Standalone volumes only: single FSx block, clone/snapshot for unique volumes.
        const [computeSettledResults, allVolumesMetrics, standaloneOnlyMetrics] = await Promise.all([
            computeSettledPromise,
            formatStorageSavingsCalculationMetrics(
                accountId,
                credentialsId,
                region,
                ebsVolumeIds,
                marketingParams,
                deploymentType,
                instanceIds
            ),
            formatStorageSavingsCalculationMetrics(
                accountId,
                credentialsId,
                region,
                standaloneEbsVolumeIds,
                marketingParams,
                ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE,
                instanceIds
            )
        ]);
        const computeAndLicenseCostList = settledFulfilledValues(computeSettledResults);
        const { existingComputeLicensePrice, recommendedComputeLicensePrice } =
            getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList);

        const { ebs, ebsCalculation, multi, fsx, fsxOptimized } = allVolumesMetrics;
        const { single, fsxOptimizedSingle, ebsCloneCalculation, ebsSnapshotCalculation } = standaloneOnlyMetrics;

        return {
            recommendedComputeCalculation: computeAndLicenseCostList.map(item => ({
                hostname: item.hostname,
                deploymentType: item.deploymentType,
                ...item.compute.recommended
            })),
            recommendedLicenseCalculation: [],
            existingComputeCalculation: computeAndLicenseCostList.map(item => ({
                hostname: item.hostname,
                deploymentType: item.deploymentType,
                ...item.compute.existing
            })),
            existingLicenseCalculation: [],
            ebsCalculation,
            ebsCloneCalculation,
            ebsSnapshotCalculation,
            single,
            multi,
            ...(fsxOptimizedSingle && { fsxOptimizedSingle }),
            ...(fsxOptimized && { fsxOptimized }),
            totalSummary: {
                existing: ebs ? ebs.total + existingComputeLicensePrice : existingComputeLicensePrice,
                recommended: fsx ? fsx.total + recommendedComputeLicensePrice : recommendedComputeLicensePrice
            }
        };
    }

    const [computeSettledResults, metricsPayload] = await Promise.all([
        computeSettledPromise,
        formatStorageSavingsCalculationMetrics(
            accountId,
            credentialsId,
            region,
            ebsVolumeIds,
            marketingParams,
            deploymentType,
            instanceIds
        )
    ]);
    const computeAndLicenseCostList = settledFulfilledValues(computeSettledResults);
    const {
        ebs,
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        single,
        multi,
        fsx,
        fsxOptimizedSingle,
        fsxOptimized
    } = metricsPayload;
    const { existingComputeLicensePrice, recommendedComputeLicensePrice } =
        getExistingAndRecommendedComputeAndLicense(computeAndLicenseCostList);

    return {
        recommendedComputeCalculation: computeAndLicenseCostList.map(item => ({
            hostname: item.hostname,
            deploymentType: item.deploymentType,
            ...item.compute.recommended
        })),
        recommendedLicenseCalculation: [],
        existingComputeCalculation: computeAndLicenseCostList.map(item => ({
            hostname: item.hostname,
            deploymentType: item.deploymentType,
            ...item.compute.existing
        })),
        existingLicenseCalculation: [],
        ebsCalculation,
        ebsCloneCalculation,
        ebsSnapshotCalculation,
        single,
        multi,
        ...(fsxOptimizedSingle && { fsxOptimizedSingle }),
        ...(fsxOptimized && { fsxOptimized }),
        totalSummary: {
            existing: ebs ? ebs.total + existingComputeLicensePrice : existingComputeLicensePrice,
            recommended: fsx ? fsx.total + recommendedComputeLicensePrice : recommendedComputeLicensePrice
        }
    };
}

export {
    extractOracleEbsVolumeIdsForHost,
    getOracleAutomaticTcoComputeDeploymentTypeForHost,
    getOracleBulkStorageSavingsCalculationMetrics,
    isOracleHostIneligibleForAutomaticEbsSavings,
    partitionOracleEbsVolumesByDeploymentType,
    performOracleBulkStorageSavingsCalculations
};
