import { DsTypography } from '@netapp/design-system';
import styles from './DetectContent.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedMultiDetectInstances } from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ACTION_CTA } from '../../../../../../utils/consts';
import { manageActionCol } from '../../../../InventoryUtilsV2';
import SeparatorComponent from '../../../../../../common/SeparatorComponent/SeparatorComponent';
import { DsSelectFsx } from '../../../../../../common/FsxSelectField/fsxSelectField';

interface OptionType {
    id: number;
    label: string;
    value: string;
}

const SelectInstances = () => {
    const dispatch = useDispatch();
    const { selectedMultiDetectInstances } = useAppSelector(state => state.inventoryV2);
    const { instanceTableRows } = useAppSelector(state => state.inventoryV2);

    const [selectedOptions, setSelectedOptions] = useState<any[]>([]);
    const [selectionType, setSelectionType] = useState<'authorized' | 'unauthorized' | null>(null);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [lastAppliedOptions, setLastAppliedOptions] = useState<any[]>([]);
    const [lastAppliedSelectionType, setLastAppliedSelectionType] = useState<'authorized' | 'unauthorized' | null>(
        null
    );

    useEffect(() => {
        setSelectedOptions(selectedMultiDetectInstances);
        if (!selectedMultiDetectInstances || selectedMultiDetectInstances.length === 0) {
            setSelectionType(null);
            setLastAppliedOptions([]);
            setLastAppliedSelectionType(null);
        } else {
            //@ts-ignore
            setSelectionType(selectedMultiDetectInstances[0].authorized ? 'authorized' : 'unauthorized');
            setLastAppliedOptions(selectedMultiDetectInstances);
            //@ts-ignore
            setLastAppliedSelectionType(selectedMultiDetectInstances[0].authorized ? 'authorized' : 'unauthorized');
        }
    }, [selectedMultiDetectInstances]);

    // When dropdown opens/closes, restore last applied state on close (Cancel)
    const handleExpandChange = (expanded: boolean) => {
        setIsDropdownOpen(expanded);
        if (!expanded) {
            setSelectedOptions(lastAppliedOptions);
            setSelectionType(lastAppliedSelectionType);
        }
    };

    const handleSelectionChange = (newSelected: any[]) => {
        if (!newSelected || newSelected.length === 0) {
            setSelectionType(null);
            setSelectedOptions([]);
            return;
        }

        // All selected options must have the same authorized status
        const firstType = newSelected[0].authorized ? 'authorized' : 'unauthorized';
        const allSameType = newSelected.every(opt => (opt.authorized ? 'authorized' : 'unauthorized') === firstType);

        if (!allSameType) {
            // Optionally show an error or just ignore the change
            return;
        }

        setSelectionType(firstType as 'authorized' | 'unauthorized');
        setSelectedOptions(newSelected);
    };

    const options = useMemo(() => {
        return instanceTableRows?.flatMap((row: any) => {
            const { colText, disableMsg } = manageActionCol(row);
            if (colText !== ACTION_CTA.MANAGE_INSTANCES || disableMsg !== '') return [];

            const isAuthorized =
                (row?.sqlServerAuthentication || row?.windowsAuthentication) &&
                (!row?.fsxId || (row?.fsxId && row?.isFsxRegistered));

            const isSelected = selectedOptions.some(opt => opt.id === row.id);

            // Only disable unselected options of the other type
            const isDisabled =
                !isSelected &&
                selectionType !== null &&
                ((selectionType === 'authorized' && !isAuthorized) ||
                    (selectionType === 'unauthorized' && isAuthorized));

            return {
                id: row.id,
                label: `${row.databaseInstanceName}, ${row.name}, ${
                    isAuthorized ? 'Authenticated' : 'Unauthenticated'
                }`,
                value: row.name,
                data: row,
                authorized: isAuthorized,
                isDisabled,
                disabledReason: isDisabled
                    ? 'When selecting multiple instances, they must have the same status: authenticated or unauthenticated.'
                    : ''
            };
        });
    }, [instanceTableRows, selectionType, selectedOptions]);
    // ...existing code...

    const handleSelect = (selected: OptionType[]) => {
        setLastAppliedOptions(selected);
        if (!selected || selected.length === 0) {
            setLastAppliedSelectionType(null);
        } else {
            //@ts-ignore
            setLastAppliedSelectionType(selected[0].authorized ? 'authorized' : 'unauthorized');
        }
        dispatch(setSelectedMultiDetectInstances(selected));
    };

    return (
        <div className={styles.detectInstanceSelect}>
            <DsSelectFsx
                title="Instances"
                isCleanable={false}
                formatLabel={() =>
                    selectedMultiDetectInstances.length > 0
                        ? `${selectedMultiDetectInstances.length} instances selected`
                        : 'Select instances'
                }
                placeholder="Select instances"
                options={options}
                value={selectedOptions}
                onSelectionChange={(selectedOptions: any) => {
                    handleSelectionChange(selectedOptions);
                }}
                selectionType="multi"
                isWithActions={true}
                onSelect={(option: any) => handleSelect(option)}
                searchMethod={{
                    method: 'basic'
                }}
                onExpandChange={handleExpandChange}
                formatOptionLabel={(option: any) => {
                    const values = option.label.split(', ');
                    return (
                        <div className={styles.detectFormatOption}>
                            <DsTypography variant="Semibold_14">{values[0]}</DsTypography>
                            <div className={styles.detectOptionValue}>
                                <div className={styles.status}>
                                    <div
                                        className={styles.statusIcon}
                                        style={{ background: option?.authorized ? '#48A08B' : '#C8C8C8' }}
                                    ></div>
                                    <DsTypography variant="Regular_14">{values[2]}</DsTypography>
                                </div>

                                <SeparatorComponent variant="vertical" height="20px" />

                                <DsTypography variant="Regular_14">Host: {values[1]}</DsTypography>
                            </div>
                        </div>
                    );
                }}
            />
        </div>
    );
};

export default SelectInstances;
