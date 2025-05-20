import { DsSelect, DsTypography } from '@netapp/design-system';
import styles from './DetectContent.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedMultiDetectInstances } from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { useMemo } from 'react';
import { ACTION_CTA } from '../../../../../../utils/consts';
import { manageActionCol } from '../../../../InventoryUtilsV2';

interface OptionType {
    id: number;
    label: string;
    value: string;
}

const SelectInstances = () => {
    const dispatch = useDispatch();
    const { selectedMultiDetectInstances } = useAppSelector(state => state.inventoryV2);
    const { instanceTableRows } = useAppSelector(state => state.inventoryV2);

    const options = useMemo(() => {
        let optionsList: any = [];
        instanceTableRows?.map((row: any) => {
            const { colText, disableMsg } = manageActionCol(row);
            if (colText === ACTION_CTA.MANAGE_INSTANCES && disableMsg === '') {
                let isAuthorized = false;
                if (
                    (row?.sqlServerAuthentication || row?.windowsAuthentication) &&
                    (!row?.fsxId || (row?.fsxId && row?.isFsxRegistered))
                ) {
                    isAuthorized = true;
                }
                optionsList.push({
                    id: row.id,
                    label: row.databaseInstanceName,
                    value: row.name,
                    data: row,
                    authorized: isAuthorized
                });
            }
        });
        return optionsList;
    }, [instanceTableRows]);

    const handleSelect = (option: OptionType) => {
        dispatch(setSelectedMultiDetectInstances(option));
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
                        <div className={styles.detectFormatOption}>
                            <DsTypography variant="Semibold_14">{option.label}</DsTypography>
                            <DsTypography variant="Regular_14">{option.value}</DsTypography>
                        </div>
                    );
                }}
            />
        </div>
    );
};

export default SelectInstances;
