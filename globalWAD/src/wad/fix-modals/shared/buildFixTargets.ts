import type { FixTarget, ResourceScanRecord } from '@tlveng/workload-factory-components/wad';

const buildFixTarget = (resource: ResourceScanRecord, fixId: string): FixTarget => ({
    id: fixId,
    ...(resource.subConfig !== undefined && { subConfig: resource.subConfig }),
    ...(resource.parentResource?.id !== undefined &&
        resource.parentResource.type !== undefined && {
            parentResource: {
                id: resource.parentResource.id,
                type: resource.parentResource.type
            }
        })
});

export const buildVolumeFixTargets = (resources: ResourceScanRecord[], selectedIds: string[]): FixTarget[] =>
    resources
        .filter(resource => selectedIds.includes(resource.id))
        .map(resource => buildFixTarget(resource, resource.id));

export const buildFileSystemFixTargets = (resources: ResourceScanRecord[], selectedIds: string[]): FixTarget[] =>
    resources
        .filter(resource => selectedIds.includes(resource.id))
        .map(resource => buildFixTarget(resource, resource.parentResource?.id ?? resource.id));
