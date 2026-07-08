import type { BulkAction } from '@tlveng/workload-factory-components';

export enum BulkActionId {
    FIX = 'fix'
}

export enum BulkActionLabel {
    FIX = 'Fix'
}

export interface CreateFixBulkActionOptions {
    isDisabled?: boolean;
    tooltip?: string;
}

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
