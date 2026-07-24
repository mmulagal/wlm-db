import { OptimizationStatus, type BulkAction, type ResourceScanRecord } from '@tlveng/workload-factory-components';

export enum BulkActionId {
    FIX = 'fix'
}

export enum BulkActionLabel {
    FIX = 'Fix'
}

export const NO_NEEDS_OPTIMIZATION_BULK_FIX_ERROR =
    'Select at least one resource that needs optimization to continue with Fix.';

export interface CreateFixBulkActionOptions {
    isDisabled?: boolean;
    tooltip?: string;
}

/** Returns only selected resources whose status is "Needs optimization". */
export const filterNeedsOptimizationResources = (resources: ResourceScanRecord[]): ResourceScanRecord[] =>
    resources.filter(resource => resource.optimizationStatus === OptimizationStatus.NOT_OPTIMIZED);

export const createFixBulkAction = (
    onFix: (resourceIds: string[]) => void | Promise<void>,
    options: CreateFixBulkActionOptions = {}
): BulkAction => ({
    id: BulkActionId.FIX,
    label: BulkActionLabel.FIX,
    onClick: onFix,
    ...(options.isDisabled !== undefined && { isDisabled: options.isDisabled }),
    ...(options.tooltip !== undefined && { tooltip: options.tooltip })
});
