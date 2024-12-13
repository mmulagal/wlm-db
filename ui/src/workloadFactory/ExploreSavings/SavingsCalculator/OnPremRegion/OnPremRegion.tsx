import { DsTypography } from '@netapp/design-system';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import styles from './OnPremRegion.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { useMemo } from 'react';
import { generateOptionType, regionsSort } from '../../../../utils/utilityFunctions';
import { setSelectedRegionFromManualTCO } from '../../../../store/workloadFactory/exploreSavingsSlice';

const OnPremRegion = () => {
    const dispatch = useDispatch();
    const { selectedManualRegion, getManualRegionsList } = useAppSelector(state => state.exploreSavings);

    //Function to generate the options for Select Field
    const generateRegionList = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        //@ts-ignore
        const sortedRegionsData = regionsSort(getManualRegionsList?.manualRegionsData?.regions || []);
        sortedRegionsData?.map((val: any, idx: number) => {
            const regionValue = val.regionCode + ' | ' + val.regionName;
            const option = generateOptionType(regionValue, regionValue, '', false, '', val);
            options.push(option);
        });
        return options;
    }, [getManualRegionsList]);
    return (
        <div className={styles.onPremRegion}>
            <DsTypography variant="Regular_14">
                Provide clone and snapshot values to calculate the cost savings.
            </DsTypography>

            <div className={styles.firstRow}>
                <SelectField
                    label={GENERAL.REGION}
                    isClearable={false}
                    value={selectedManualRegion}
                    onChange={(selectedOptions: any): void => {
                        dispatch(setSelectedRegionFromManualTCO(selectedOptions));
                    }}
                    isSearchable={generateRegionList.length > 5}
                    options={generateRegionList}
                    className={`${styles.widthRegionSet} savings-calculator-input-fields`}
                />
            </div>
        </div>
    );
};

export default OnPremRegion;
