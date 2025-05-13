import { DsSelect, DsTypography } from '@netapp/design-system';
import styles from './DetectContent.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedDetectInstances } from '../../../../../../store/workloadFactory/inventoryV2Slice';
import { useAppSelector } from '../../../../../../store/storeHooks';

interface OptionType {
    id: number;
    label: string;
    value: string;
}

const SelectInstances = () => {
    const dispatch = useDispatch();
    const { selectedDetectInstances } = useAppSelector(state => state.inventoryV2);
    const options: OptionType[] = [
        {
            id: 0,
            label: 'instance name 1',
            value: 'host name 1'
        },
        {
            id: 1,
            label: 'instance name 2',
            value: 'host name 2'
        }
    ];
    const handleSelect = (option: OptionType) => {
        dispatch(setSelectedDetectInstances(option));
    };
    return (
        <div className={styles.detectInstanceSelect}>
            <DsSelect
                title="Instances"
                isCleanable={false}
                formatLabel={() =>
                    selectedDetectInstances.length > 0
                        ? `${selectedDetectInstances.length} instances selected`
                        : 'Select instances'
                }
                placeholder="Select instances"
                options={options}
                selectionType="multi"
                isWithActions={true}
                onSelect={(option: any) => handleSelect(option)}
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
