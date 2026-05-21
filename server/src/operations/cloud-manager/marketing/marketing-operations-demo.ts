import { isEmpty } from 'lodash-es';
import {
    DEMO_STANDALONE_INSTANCE_ID,
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG,
    ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE,
    SqlServerDeploymentModel
} from '../../../utils/consts';
import { getEbsManualModeStorageSavings, getFsxwManualModeStorageSavings } from '../../../lib/cloud-manager/marketing';
import { convertToBytes } from '../../../utils/utils';
import {
    FsxCostCalculations,
    ManualModeEbsComparisonV2Response,
    ManualModeFsxwComparisonResponse,
    StorageSummary
} from '../../../utils/marketing-types';
import {
    getEbsMarketingApiManualModeRequestBody,
    getFsxwMarketingApiManualModeRequestBody
} from './marketing-request-utils';
import {
    getOracleTcoEbsDemoMarketingVolsAndInstanceType,
    ORACLE_TCO_DEMO_EBS_HOST_TCO_SIZE
} from '../../demo-operations';

/* eslint-disable camelcase */
async function fsxwAutomaticDemoModeCallingManualApi(
    region: string,
    clonedCopiesCount: number,
    sqlServerDeploymentType: string,
    monthlyChangeRatePercentage: number,
    accountId: string,
    snapshotFrequency?: string
) {
    const marketingRequestBody = getFsxwMarketingApiManualModeRequestBody(region, {
        clonedCopiesCount,
        sqlServerDeploymentType,
        monthlyChangeRatePercentage,
        snapshotFrequency: snapshotFrequency ?? 'Daily',
        sqlServerEdition: 'Enterprise',
        ec2Instances: [
            {
                ec2InstanceDescription: 'Primary',
                ec2InstanceType: 'm5.large',
                isPrimary: true,
                fsxw: {
                    storageAmount: 640000000000,
                    deploymentType: 'Multi',
                    volumeIops: 600,
                    throughput: 32,
                    storageVolumeType: 'SSD'
                }
            }
        ]
    });

    const {
        fsxw,
        fsx,
        fsx_calculation,
        fsxw_cost_calculation,
        fsx_cost_calculation_no_snapshot,
        fsx_snapshot_cost_calculation,
        fsx_clone_cost_calculation
    } = await getFsxwManualModeStorageSavings<ManualModeFsxwComparisonResponse>(accountId, marketingRequestBody);

    return {
        fsxw,
        fsx,
        [sqlServerDeploymentType === 'FCI' || sqlServerDeploymentType === ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG
            ? 'multi'
            : 'single']: {
            fsxw_cost_calculation,
            fsx_calculation,
            fsx_cost_calculation_no_snapshot,
            fsx_snapshot_cost_calculation,
            fsx_clone_cost_calculation
        }
    };
}

async function ebsAutomaticDemoModeCallingManualApi(
    sqlServerDeploymentType: string,
    instanceIds: string[] | undefined,
    region: string,
    clonedCopiesCount: number,
    monthlyChangeRatePercentage: number,
    accountId: string,
    snapshotFrequency?: string
) {
    let volumes = [
        {
            volumeType: 'io2',
            volumeNumber: 2,
            storageAmount: convertToBytes(1024 * 2, 'GiB') || 0,
            volumeIops: 40000,
            throughput: 128
        }
    ];
    let primaryEc2InstanceType = 'm5.4xlarge';
    if (
        sqlServerDeploymentType === SqlServerDeploymentModel.SQL_STANDALONE_SHORT &&
        instanceIds?.includes(DEMO_STANDALONE_INSTANCE_ID)
    ) {
        volumes = [
            {
                volumeType: 'io2',
                volumeNumber: 1,
                storageAmount: convertToBytes(1024 * 2, 'GiB') || 0,
                volumeIops: 40000,
                throughput: 128
            },
            {
                volumeType: 'io1',
                volumeNumber: 1,
                storageAmount: convertToBytes(1024 * 2, 'GiB') || 0,
                volumeIops: 40000,
                throughput: 128
            }
        ];
    } else if (sqlServerDeploymentType === SqlServerDeploymentModel.SQL_AOAG_SHORT) {
        volumes = [
            {
                volumeType: 'io2',
                volumeNumber: 2,
                storageAmount: convertToBytes(1024 * 10, 'GiB') || 0,
                volumeIops: 40000,
                throughput: 128
            }
        ];
    } else if (
        (sqlServerDeploymentType === ORACLE_AUTOMATIC_TCO_DEPLOYMENT_STANDALONE ||
            sqlServerDeploymentType === ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG) &&
        (instanceIds ?? []).some(id => ORACLE_TCO_DEMO_EBS_HOST_TCO_SIZE[id] != null)
    ) {
        const tco = getOracleTcoEbsDemoMarketingVolsAndInstanceType(instanceIds);
        if (tco) {
            ({ volumes, ec2InstanceType: primaryEc2InstanceType } = tco);
        }
    }

    const marketingRequestBody = getEbsMarketingApiManualModeRequestBody(region, {
        clonedCopiesCount,
        sqlServerDeploymentType,
        monthlyChangeRatePercentage,
        snapshotFrequency: snapshotFrequency ?? 'Daily',
        sqlServerEdition: 'Enterprise',
        ec2Instances: [
            {
                ec2InstanceDescription: 'Primary',
                ec2InstanceType: primaryEc2InstanceType,
                isPrimary: true,
                volumes
            }
        ]
    });

    const {
        ebsTotal,
        ebsResults,
        fsx,
        fsx_calculation,
        fsx_cost_calculation_no_snapshot,
        fsx_snapshot_cost_calculation,
        fsx_clone_cost_calculation
    } = await getEbsManualModeStorageSavings<ManualModeEbsComparisonV2Response>(accountId, marketingRequestBody);

    const { fsx_optimized, fsx_optimized_single } = generateOptimizedValuesForDemo(fsx, {
        fsx_calculation,
        fsx_cost_calculation_no_snapshot,
        fsx_snapshot_cost_calculation,
        fsx_clone_cost_calculation
    });

    let fsxData;
    if (
        sqlServerDeploymentType !== SqlServerDeploymentModel.SQL_AOAG_SHORT &&
        sqlServerDeploymentType !== ORACLE_AUTOMATIC_TCO_DEPLOYMENT_DG
    ) {
        fsxData = {
            single: {
                fsx_calculation,
                fsx_cost_calculation_no_snapshot,
                fsx_snapshot_cost_calculation,
                fsx_clone_cost_calculation
            } as FsxCostCalculations
        };
    } else {
        fsxData = {
            multi: {
                fsx_calculation,
                fsx_cost_calculation_no_snapshot,
                fsx_snapshot_cost_calculation,
                fsx_clone_cost_calculation
            } as FsxCostCalculations
        };
    }
    return {
        ebs: ebsTotal,
        ebsClassification: ebsResults,
        fsx,
        ...(!isEmpty(fsxData) && {
            ...fsxData
        }),
        ...(fsx_optimized && { fsxOptimized: fsx_optimized }),
        ...(fsx_optimized_single && { fsxOptimizedSingle: fsx_optimized_single })
    };
}

function generateOptimizedValuesForDemo(fsx: StorageSummary, fsxCalculations: FsxCostCalculations) {
    // Optimization rate - 75%
    // throughput and iops are reduced by OPT_RATE percent
    const OPT_RATE = 75;
    const iops = Number(fsx.iops ?? 0) * (1 - OPT_RATE / 100);
    const throughput = Number(fsx.throughput ?? 0) * (1 - OPT_RATE / 100);
    const fsx_optimized = {
        ...fsx,
        iops,
        throughput,
        total: fsx.total - (fsx.iops + fsx.throughput) + (iops + throughput) // Subtract the actual values and add optimized values
    };
    const fsx_optimized_single = {
        ...fsxCalculations,
        fsx_calculation: {
            ...fsxCalculations.fsx_calculation,
            throughput: Number(fsxCalculations?.fsx_calculation?.throughput ?? 0) * (1 - OPT_RATE / 100),
            ssdIop: Number(fsxCalculations?.fsx_calculation?.ssdIop ?? 0) * (1 - OPT_RATE / 100)
        }
    };

    return {
        fsx_optimized,
        fsx_optimized_single
    };
}

export { fsxwAutomaticDemoModeCallingManualApi, ebsAutomaticDemoModeCallingManualApi };
