import React from 'react';
import { SelectionType } from './useTable';
import { Checkbox, CheckButton } from '@netapp/design-system';

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
}: Omit<SelectionCellProps, 'selectionType'>) => {
    return (
        <Checkbox
            variant={'tableCheckbox'}
            isChecked={isSelected}
            onChange={onChange}
            isDisabled={isDisabled}
            {...rest}
        />
    );
};

const SingleSelectionCell = ({
    isSelected,
    onChange,
    isDisabled,
    ...rest
}: Omit<SelectionCellProps, 'selectionType'>) => {
    return <CheckButton isChecked={isSelected} onChange={onChange} isDisabled={isDisabled} {...rest} />;
};

export const SELECTION_TYPE = {
    NONE: 'none',
    SINGULAR: 'singular',
    MULTIPLE: 'multiple'
};
