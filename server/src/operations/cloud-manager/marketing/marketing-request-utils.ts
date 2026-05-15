import { compact, partition } from 'lodash-es';
import { ManualStorageSavingsRequestBodyType } from '../../../routes/types/storage-savings.types';
import { isMultiAzDeployment, sizeInGigaBytes } from '../../../utils/utils';

const NO_SNAPSHOT_STORAGE = 'NoSnapShotStorage';

interface Volume {
    volumeType: string;
    volumeNumber: number;
    storageAmount: number;
    volumeIops?: number;
    throughput?: number;
}

function hasDuplicateVolumeType(volumes: Volume[]) {
    const volumeTypes = volumes.map((volume: Volume) => volume.volumeType);
    const uniqueVolumeTypes = new Set(volumeTypes);
    return volumeTypes.length > uniqueVolumeTypes.size;
}

function mapVolumeToMarketingFormat(
    volume: Volume,
    snapshotFrequency?: string,
    monthlyChangeRatePercentage?: number,
    isPrimary: boolean = true
) {
    const { volumeType, volumeNumber, storageAmount, volumeIops, throughput } = volume || {};

    if (!volumeType || !volumeNumber || !storageAmount) {
        throw new Error('volumeType, volumeNumber and storageAmount are required for each volume');
    }

    let snapshots;
    // Per-volume contract: callers (UI manual mode, on-prem TCO helpers, demo) all supply
    // storageAmount/volumeIops/throughput as values for a SINGLE volume; `volumeNumber` is the
    // count of identical volumes in this bucket. The marketing API expects the same per-volume
    // shape, so we pass these fields through and compute the per-volume snapshot capacity from
    // the per-volume storage size (GROGU-5182).
    const perVolumeStorageGib = sizeInGigaBytes(storageAmount, 'B');
    if (isPrimary && snapshotFrequency && snapshotFrequency !== NO_SNAPSHOT_STORAGE) {
        const snapshotPercentageChange = monthlyChangeRatePercentage || 0;
        const snapshotCapacityGib = (snapshotPercentageChange / 100) * perVolumeStorageGib;
        snapshots = {
            snapshotFreq: snapshotFrequency,
            snapshotAmountChange: {
                size: snapshotCapacityGib,
                unit: 'GiB'
            }
        };
    } else {
        snapshots = {
            snapshotFreq: NO_SNAPSHOT_STORAGE,
            snapshotAmountChange: {
                size: 0,
                unit: 'GiB'
            }
        };
    }
    return {
        volumeType,
        volumeNumber,
        storageAmount: {
            size: perVolumeStorageGib,
            unit: 'GiB'
        },
        volumeIops: volumeIops && volumeIops > 0 ? volumeIops : 0,
        throughput: throughput && throughput > 0 ? throughput : 0,
        ...snapshots
    };
}

function getEbsMarketingApiManualModeRequestBody(region: string, params: ManualStorageSavingsRequestBodyType) {
    const { snapshotFrequency, sqlServerDeploymentType, clonedCopiesCount, monthlyChangeRatePercentage, ec2Instances } =
        params || {};

    const [primaryInstances, secondaryInstances] = partition(ec2Instances || [], 'isPrimary');

    const primaryVolumesRaw = compact(primaryInstances.flatMap(instance => instance.volumes));
    const secondaryVolumesRaw = compact(secondaryInstances.flatMap(instance => instance.volumes));

    if (hasDuplicateVolumeType(primaryVolumesRaw) || hasDuplicateVolumeType(secondaryVolumesRaw)) {
        throw new Error('Duplicate volume types are not allowed');
    }

    const primaryInstanceVolumes = primaryVolumesRaw.map(volume =>
        mapVolumeToMarketingFormat(volume, snapshotFrequency, monthlyChangeRatePercentage, true)
    );

    const secondaryInstanceVolumes =
        secondaryVolumesRaw.map(volume =>
            mapVolumeToMarketingFormat(volume, snapshotFrequency, monthlyChangeRatePercentage, false)
        ) || [];
    // The following return type includes internal-use properties (primaryInstanceVolumes and secondaryInstanceVolumes)
    // for downstream calculations. These are not part of the public API contract and should be used only internally.
    return {
        useCase: 'Low-latency',
        region,
        deploymentType: isMultiAzDeployment(sqlServerDeploymentType) ? 'Multi' : 'Single',
        fsxSnapshotFreq: snapshotFrequency,
        clones: {
            changeRate: monthlyChangeRatePercentage,
            cloneEnvs: clonedCopiesCount > 0 ? clonedCopiesCount : 0
        },
        volumes: [...primaryInstanceVolumes, ...secondaryInstanceVolumes],
        // Internal-use only: used for further calculations, not part of the public API contract
        primaryInstanceVolumes,
        secondaryInstanceVolumes
    };
}

function getFsxwMarketingApiManualModeRequestBody(region: string, params: ManualStorageSavingsRequestBodyType) {
    const { snapshotFrequency, clonedCopiesCount, monthlyChangeRatePercentage, ec2Instances } = params || {};

    const [fsxObject] = compact(
        ec2Instances?.map(instance => {
            const { fsxw } = instance;
            if (fsxw) {
                const { storageAmount, deploymentType, volumeIops, throughput, storageVolumeType } = fsxw;
                return {
                    useCase: 'Low-latency',
                    region,
                    deploymentType: deploymentType === 'Single' ? 'Single' : 'Multi',
                    storageAmount: {
                        size: sizeInGigaBytes(storageAmount, 'B'),
                        unit: 'GiB'
                    },
                    iops: volumeIops,
                    throughput,
                    storageVolumeType,
                    snapshotFreq: snapshotFrequency,
                    deduplicationSavings: 0,
                    cloneEnvs: clonedCopiesCount,
                    monthlyChangeRate: monthlyChangeRatePercentage
                };
            }
            return null;
        })
    );
    return fsxObject;
}

export { getEbsMarketingApiManualModeRequestBody, getFsxwMarketingApiManualModeRequestBody };
