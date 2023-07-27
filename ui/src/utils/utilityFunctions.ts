import { optionType } from '@netapp/design-system/dist/components/Select';
import { TableProps } from '@netapp/design-system/dist/components/Table';

export const generateOptionType = (
    value: string,
    label: string,
    label2: string,
    isDisabled: boolean,
    disabledTitle: string
) => {
    const option: optionType = {
        value: value,
        label: label,
        label2: label2,
        isDisabled: isDisabled,
        disabledTitle: disabledTitle
    };
    return option;
};

export function getSelectedFromSelectionState<T extends { id: string }>(
    selectionState: TableProps['selectionState'],
    data: T[]
): T[] {
    const selectedRows = selectionState?.rows;

    if (!selectedRows) return [];

    const rows: T[] = [];

    for (let item in selectedRows) {
        if (selectedRows[item]) {
            const entry = data.find(entry => {
                return entry.id === item;
            });

            if (entry) {
                rows.push(entry);
            }
        }
    }

    return rows;
}
