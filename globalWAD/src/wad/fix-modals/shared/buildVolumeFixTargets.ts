import type { FixTarget, ResourceScanRecord } from '@tlveng/workload-factory-components';

export const buildVolumeFixTargets = (resources: ResourceScanRecord[], volumeIds: string[]): FixTarget[] =>
    resources
        .filter(resource => volumeIds.includes(resource.id))
        .map(resource => ({
            id: resource.id,
            ...(resource.subConfig !== undefined && { subConfig: resource.subConfig }),
            ...(resource.parentResource?.id !== undefined &&
                resource.parentResource.type !== undefined && {
                    parentResource: {
                        id: resource.parentResource.id,
                        type: resource.parentResource.type
                    }
                })
        }));
