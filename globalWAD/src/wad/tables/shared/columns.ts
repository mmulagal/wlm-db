import type { TableColumn } from '@tlveng/workload-factory-components';

export const spliceExtras = <TRow>(
    defaults: ReadonlyArray<TableColumn<TRow>>,
    extras: ReadonlyArray<TableColumn<TRow>> | undefined,
    anchorId: string
): ReadonlyArray<TableColumn<TRow>> => {
    if (!extras || extras.length === 0) return defaults;
    const anchorIndex = defaults.findIndex(column => column.id === anchorId);
    if (anchorIndex < 0) return [...defaults, ...extras];
    return [...defaults.slice(0, anchorIndex), ...extras, ...defaults.slice(anchorIndex)];
};
