import { DsTypography, TextField } from '@netapp/design-system';
import { useEffect, useMemo, useState } from 'react';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { useDispatch } from 'react-redux';
import styles from './ManualTCOFields.module.scss';
import { generateOptionType, regionsSort } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';
import {
    setMonthlyChangeRate,
    setNumberOfClonedCopies,
    setRegionChangeInstanceLoading,
    setSelectedDeploymentModelForManualTCO,
    setSelectedManualServerEdition,
    setSelectedMonthlyBYOLCost,
    setSelectedRegionFromManualTCO,
    setSelectedSnapshotFrequency
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { SAVINGS_CALC_MODE, SNAPSHOT_FREQUENCY } from '../../../../utils/consts';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

interface ManualTCOFieldsProps {
    printState: boolean;
}

const ManualTCOFields = ({ printState }: ManualTCOFieldsProps) => {
    const dispatch = useDispatch();
    const {
        selectedManualRegion,
        selectedManualDeploymentModel,
        monthlyBYOLCost,
        numberOfClonedCopies,
        monthlyChangeRate,
        selectedManualServerEdition,
        selectedSnapshotFrequency,
        savingsCalculatorFrom
    } = useAppSelector(state => state.exploreSavings);
    const { headerSelectedRegion } = useAppSelector(state => state.headers);
    const { getManualRegionsList } = useAppSelector(state => state.exploreSavings);

    const [textSearch, setTextSearch] = useSearchDebounce(500);

    const [machineDesc, setMachineDesc] = useState(monthlyBYOLCost || '');

    // Use effect for machine description
    useEffect(() => {
        setTextSearch(machineDesc);
    }, [machineDesc]);

    useEffect(() => {
        dispatch(setSelectedMonthlyBYOLCost(textSearch));
    }, [textSearch]);

    // Setting monthly data rate change for FsxW
    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW) {
            dispatch(setMonthlyChangeRate(3));
        }
    }, [savingsCalculatorFrom]);

    // Function to generate the options for Select Field
    const generateRegionList = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        // @ts-ignore
        const sortedRegionsData = regionsSort(getManualRegionsList?.manualRegionsData?.regions || []);
        sortedRegionsData?.map((val, idx: number) => {
            const regionValue = `${val.regionCode} | ${val.regionName}`;
            const option = generateOptionType(regionValue, regionValue, '', false, '', val);
            options.push(option);
        });
        return options;
    }, [getManualRegionsList]);

    useEffect(() => {
        if (!selectedManualRegion) {
            // @ts-ignore
            const simplifiedRegions = generateRegionList.map(item => item?.data?.regionCode);

            const foundRegion = simplifiedRegions.indexOf(headerSelectedRegion?.data?.regionCode);

            if (foundRegion === -1) {
                dispatch(setSelectedRegionFromManualTCO(generateRegionList[0]));
            } else {
                dispatch(setSelectedRegionFromManualTCO(generateRegionList[foundRegion]));
            }
        }
    }, [generateRegionList]);

    // Function to generate the options for Select Field
    const generateSQLEditionList = useMemo<optionType[]>((): optionType[] => {
        const deploymentModel = [
            'SQL server Standard',
            'SQL server Enterprise',
            'SQL server Web',
            'SQL server Developer'
        ];
        const options: optionType[] = [];
        deploymentModel?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        if (!selectedManualServerEdition) dispatch(setSelectedManualServerEdition(generateSQLEditionList[0]));
    }, [generateSQLEditionList]);

    // Function to generate the options for Select Field
    const generateDeploymentModelList = useMemo<optionType[]>((): optionType[] => {
        const deploymentModel =
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS
                ? [GENERAL.STANDALONE, GENERAL.AOAG]
                : [GENERAL.STANDALONE, GENERAL.FCI];
        const options: optionType[] = [];
        deploymentModel?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        if (!selectedManualDeploymentModel)
            dispatch(setSelectedDeploymentModelForManualTCO(generateDeploymentModelList[0]));
    }, [generateDeploymentModelList]);

    // Function to generate the options for Select Field
    const generateSnapshotFrequency = useMemo<optionType[]>((): optionType[] => {
        const frequency = SNAPSHOT_FREQUENCY;
        const options: optionType[] = [];
        frequency?.map((val, idx: number) => {
            const option = generateOptionType(val?.value, val?.label, '', false, '', val);
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        if (!selectedSnapshotFrequency) {
            dispatch(setSelectedSnapshotFrequency(generateSnapshotFrequency[2]));
        }
    }, [generateSnapshotFrequency]);

    const errorForClonedCopiesCount = () => {
        if (numberOfClonedCopies > 10) {
            return GENERAL.CLONED_COPIES_MAX_LIMIT;
        }
    };

    const errorForChangeRate = () => {
        if (monthlyChangeRate > 100) {
            return GENERAL.CHANGE_RATE_MAX_LIMIT;
        }
    };

    return (
        <div className={styles.manualTCOFields}>
            <DsTypography variant="Regular_14">
                {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS
                    ? GENERAL.SAVINGS_MANUAL_TEXT
                    : GENERAL.SAVINGS_MANUAL_FSXW_TEXT}
            </DsTypography>

            <div className={styles.firstContainer}>
                <div className={styles.firstRow}>
                    <SelectField
                        label={GENERAL.REGION}
                        isClearable={false}
                        value={selectedManualRegion}
                        onChange={(selectedOptions: any): void => {
                            dispatch(setSelectedRegionFromManualTCO(selectedOptions));
                            dispatch(setRegionChangeInstanceLoading(true));
                        }}
                        isSearchable={generateRegionList.length > 5}
                        options={generateRegionList}
                        className={`${styles.widthRegionSet} savings-calculator-input-fields`}
                    />
                </div>

                <div className={styles.secondRow}>
                    <SelectField
                        label="Deployment model"
                        isClearable={false}
                        defaultValue={selectedManualDeploymentModel || [generateDeploymentModelList[0]]}
                        onChange={(selectedOptions: any): void => {
                            dispatch(setSelectedDeploymentModelForManualTCO(selectedOptions));
                        }}
                        isSearchable={generateDeploymentModelList.length > 5}
                        options={generateDeploymentModelList}
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                    />

                    <SelectField
                        label="SQL server edition"
                        isClearable={false}
                        defaultValue={selectedManualServerEdition || [generateSQLEditionList[0]]}
                        onChange={(selectedOptions: any): void => {
                            dispatch(setSelectedManualServerEdition(selectedOptions));
                        }}
                        isSearchable={generateSQLEditionList.length > 5}
                        options={generateSQLEditionList}
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                    />
                </div>

                <div className={styles.secondRow}>
                    {!printState && (
                        <TextField
                            label={GENERAL.MONTHLY_DATA_CHANGE_RATE}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                dispatch(setMonthlyChangeRate(numVal));
                            }}
                            value={monthlyChangeRate || ''}
                            className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                            info={GENERAL.MONTHLY_CHANGE_RATE_TOOLTIP}
                            error={errorForChangeRate()}
                        />
                    )}
                    {printState && (
                        <div className={CommonStyles.mockInputClone}>
                            <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                                {GENERAL.MONTHLY_DATA_CHANGE_RATE}
                            </DsTypography>
                            <div className={CommonStyles.inputField}>{monthlyChangeRate}</div>
                        </div>
                    )}
                    <SelectField
                        label={GENERAL.ES_SNAPSHOT_FREQUENCY}
                        isClearable={false}
                        defaultValue={selectedSnapshotFrequency || [generateSnapshotFrequency[2]]}
                        onChange={(selectedOptions: any): void => {
                            dispatch(setSelectedSnapshotFrequency(selectedOptions));
                        }}
                        isSearchable={generateSnapshotFrequency.length > 5}
                        options={generateSnapshotFrequency}
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                    />
                </div>

                <div className={styles.secondRow}>
                    {!printState && (
                        <TextField
                            label={GENERAL.NUMBER_OF_CLONED_COPIES}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                dispatch(setNumberOfClonedCopies(numVal));
                            }}
                            value={numberOfClonedCopies}
                            className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                            error={errorForClonedCopiesCount()}
                        />
                    )}
                    {printState && (
                        <div className={CommonStyles.mockInputClone}>
                            <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                                {GENERAL.NUMBER_OF_CLONED_COPIES}
                            </DsTypography>
                            <div className={CommonStyles.inputField}>{numberOfClonedCopies}</div>
                        </div>
                    )}

                    {!printState && (
                        <TextField
                            label={GENERAL.BYOL_TEXT}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                setMachineDesc(numVal);
                            }}
                            isOptional
                            value={machineDesc}
                            className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                        />
                    )}
                    {printState && (
                        <div className={CommonStyles.mockInputClone}>
                            <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                                {GENERAL.BYOL_TEXT}
                            </DsTypography>
                            <div className={CommonStyles.inputField}>{machineDesc}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualTCOFields;
