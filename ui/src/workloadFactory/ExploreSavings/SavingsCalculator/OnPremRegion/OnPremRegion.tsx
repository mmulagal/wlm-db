import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { useDispatch } from 'react-redux';
import { useEffect, useMemo } from 'react';
import styles from './OnPremRegion.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useAppSelector } from '../../../../store/storeHooks';
import { generateOptionType, regionsSort } from '../../../../utils/utilityFunctions';
import { setSelectedOnPremRegion } from '../../../../store/workloadFactory/exploreSavingsSlice';

const OnPremRegion = () => {
    const dispatch = useDispatch();
    const { selectedOnPremRegion, getOnPremRegionList } = useAppSelector(state => state.exploreSavings);
    const { headerSelectedRegion } = useAppSelector(state => state.headers);

    // Function to generate the options for Select Field
    const generateRegionList = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        // @ts-ignore
        const sortedRegionsData = regionsSort(getOnPremRegionList?.onPremRegionsData?.regions || []);
        sortedRegionsData?.map((val: any) => {
            const regionValue = `${val.regionCode} | ${val.regionName}`;
            const option = generateOptionType(regionValue, regionValue, '', false, '', val);
            options.push(option);
            return null;
        });
        return options;
    }, [getOnPremRegionList]);

    useEffect(() => {
        if (!selectedOnPremRegion && generateRegionList.length > 0) {
            // @ts-ignore
            const simplifiedRegions = generateRegionList.map(item => item?.data?.regionCode);

            const foundRegion = simplifiedRegions.indexOf(headerSelectedRegion?.data?.regionCode);

            if (foundRegion === -1) {
                dispatch(setSelectedOnPremRegion(generateRegionList[0]));
            } else {
                dispatch(setSelectedOnPremRegion(generateRegionList[foundRegion]));
            }
        }
    }, [generateRegionList, selectedOnPremRegion, headerSelectedRegion]);

    return (
        <div className={styles.onPremRegion}>
            <div className={styles.firstRow}>
                <SelectField
                    label={GENERAL.REGION}
                    isClearable={false}
                    value={selectedOnPremRegion}
                    onChange={(selectedOptions: any): void => {
                        dispatch(setSelectedOnPremRegion(selectedOptions));
                    }}
                    isSearchable={generateRegionList.length > 5}
                    options={generateRegionList}
                    className={`${styles.widthRegionSet} savings-calculator-input-fields`}
                    isLoading={getOnPremRegionList?.onPremRegionsLoading}
                />
            </div>
        </div>
    );
};

export default OnPremRegion;
