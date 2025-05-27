import { DsSelect, DsTypography } from '@netapp/design-system';
import styles from './DetectContent.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedMultiDetectInstances } from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ACTION_CTA } from '../../../../../../utils/consts';
import { manageActionCol } from '../../../../InventoryUtilsV2';
import SeparatorComponent from '../../../../../../common/SeparatorComponent/SeparatorComponent';

interface OptionType {
    id: number;
    label: string;
    value: string;
}

const SelectInstances = () => {
    const dispatch = useDispatch();
    const { selectedMultiDetectInstances } = useAppSelector(state => state.inventoryV2);
    const { instanceTableRows } = useAppSelector(state => state.inventoryV2);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<'authorized' | 'unauthorized' | null>(null);

    // Stable reference map to preserve object identity
    const optionCacheRef = useRef<Map<string, any>>(new Map());

    const options = useMemo(() => {
        const newMap = new Map<string, any>();
        const finalOptions: any[] = [];

        instanceTableRows?.forEach((row: any) => {
            const { colText, disableMsg } = manageActionCol(row);

            if (colText === ACTION_CTA.MANAGE_INSTANCES && disableMsg === '') {
                const isAuthorized =
                    (row?.sqlServerAuthentication || row?.windowsAuthentication) &&
                    (!row?.fsxId || (row?.fsxId && row?.isFsxRegistered));

                const id = row.id;

                const isSelected = selectedId === id;

                const isDisabled =
                    selectedId !== null &&
                    selectedType !== null &&
                    !isSelected &&
                    ((selectedType === 'authorized' && !isAuthorized) ||
                        (selectedType === 'unauthorized' && isAuthorized));

                // Use existing option if present
                let baseOption = optionCacheRef.current.get(id);

                if (!baseOption) {
                    // Create a fresh one if not in cache
                    baseOption = {
                        id,
                        label: row.databaseInstanceName,
                        value: row.name,
                        data: row,
                        authorized: isAuthorized
                    };
                }

                // Always create a fresh onClick to avoid stale closure
                baseOption.onClick = () => {
                    setSelectedId(prevId => (prevId === id ? null : id));
                    setSelectedType(prevType =>
                        selectedId === id ? null : isAuthorized ? 'authorized' : 'unauthorized'
                    );
                };

                // Always update these to match current state
                baseOption.isDisabled = isDisabled;
                baseOption.disabledReason = isDisabled
                    ? 'When selecting multiple instances, they must have the same status: authenticated or unauthenticated.'
                    : '';

                newMap.set(id, baseOption);
                finalOptions.push(baseOption);
            }
        });

        optionCacheRef.current = newMap;

        return finalOptions;
    }, [instanceTableRows, selectedId, selectedType]);

    const handleSelect = (option: OptionType) => {
        dispatch(setSelectedMultiDetectInstances(option));
    };

    const handleChange = () => {
        console.log('handleChange called');
    };

    return (
        <div className={styles.detectInstanceSelect}>
            <DsSelect
                title="Instances"
                isCleanable={false}
                formatLabel={() =>
                    selectedMultiDetectInstances.length > 0
                        ? `${selectedMultiDetectInstances.length} instances selected`
                        : 'Select instances'
                }
                placeholder="Select instances"
                options={options}
                selectionType="multi"
                isWithActions={true}
                onSelect={(option: any) => handleSelect(option)}
                searchMethod={{
                    method: 'smart'
                }}
                formatOptionLabel={(option: any) => {
                    return (
                        <div onClick={handleChange} className={styles.detectFormatOption}>
                            <DsTypography variant="Semibold_14">{option.label}</DsTypography>
                            <div className={styles.detectOptionValue}>
                                <div className={styles.status}>
                                    <div
                                        className={styles.statusIcon}
                                        style={{ background: option?.authorized ? '#48A08B' : '#C8C8C8' }}
                                    ></div>
                                    <DsTypography variant="Regular_14">
                                        {option?.authorized ? 'Authenticated' : 'Unauthenticated'}
                                    </DsTypography>
                                </div>

                                <SeparatorComponent variant="vertical" height="20px" />

                                <DsTypography variant="Regular_14">Host: {option.value}</DsTypography>
                            </div>
                        </div>
                    );
                }}
            />
        </div>
    );
};

export default SelectInstances;
