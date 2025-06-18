import React from 'react';
import { Checkbox, CheckButton } from '@netapp/design-system';
import { SelectionType } from './useTable';

interface SelectionCellProps {
    selectionType: SelectionType;
    onChange?: (newValue: boolean, e: React.FormEvent<HTMLInputElement>) => void;
    isSelected: boolean;
    isDisabled: boolean;
}

export const SelectionCell = (props: SelectionCellProps) => {
    const { selectionType, ...rest } = props;
    return selectionType === SELECTION_TYPE.MULTIPLE ? (
        <MultipleSelectionCell {...rest} />
    ) : (
        <SingleSelectionCell {...rest} />
    );
};

const MultipleSelectionCell = ({
    isSelected,
    onChange,
    isDisabled,
    ...rest
}: Omit<SelectionCellProps, 'selectionType'>) => (
    <Checkbox variant="tableCheckbox" isChecked={isSelected} onChange={onChange} isDisabled={isDisabled} {...rest} />
);

const SingleSelectionCell = ({
    isSelected,
    onChange,
    isDisabled,
    ...rest
}: Omit<SelectionCellProps, 'selectionType'>) => (
    <CheckButton isChecked={isSelected} onChange={onChange} isDisabled={isDisabled} {...rest} />
);

export const SELECTION_TYPE = {
    NONE: 'none',
    SINGULAR: 'singular',
    MULTIPLE: 'multiple'
};
