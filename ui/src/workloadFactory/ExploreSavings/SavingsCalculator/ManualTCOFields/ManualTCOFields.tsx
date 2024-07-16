import { DsTypography, TextField } from '@netapp/design-system';
import styles from './ManualTCOFields.module.scss';
import { useEffect, useMemo } from 'react';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { SelectField, optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../../utils/appConstants';
import {
    setMonthlyChangeRate,
    setNumberOfClonedCopies,
    setSelectedDeploymentModelForManualTCO,
    setSelectedManualServerEdition,
    setSelectedMonthlyBYOLCost,
    setSelectedRegionFromManualTCO
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';

const ManualTCOFields = () => {
    const dispatch = useDispatch();
    const {
        selectedManualRegion,
        selectedManualDeploymentModel,
        monthlyBYOLCost,
        numberOfClonedCopies,
        monthlyChangeRate,
        selectedManualServerEdition
    } = useAppSelector(state => state.exploreSavings);

    //Function to generate the options for Select Field
    const generateRegionList = useMemo<optionType[]>((): optionType[] => {
        const regions = ['us-east-1 | US East (N.Virginia)', 'us-east-1 | US East (Ohio)'];
        const options: optionType[] = [];
        regions?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        dispatch(setSelectedRegionFromManualTCO(generateRegionList[0]));
    }, [generateRegionList]);

    //Function to generate the options for Select Field
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
        dispatch(setSelectedManualServerEdition(generateSQLEditionList[0]));
    }, [generateSQLEditionList]);

    //Function to generate the options for Select Field
    const generateDeploymentModelList = useMemo<optionType[]>((): optionType[] => {
        const deploymentModel = ['Standalone', 'Always on availability group'];
        const options: optionType[] = [];
        deploymentModel?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

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
                Select a Microsoft SQL server on Amazon EC2 with EBS configuration so that we can compare your costs
                when using Microsoft SQL server on FSx for ONTAP instead
            </DsTypography>

            <div className={styles.firstContainer}>
                <div className={styles.firstRow}>
                    <SelectField
                        label={GENERAL.REGION}
                        isClearable={false}
                        defaultValue={selectedManualRegion ? selectedManualRegion : [generateRegionList[0]]}
                        onChange={(selectedOptions: any): void => {
                            dispatch(setSelectedRegionFromManualTCO(selectedOptions));
                        }}
                        isSearchable={generateRegionList.length > 5}
                        options={generateRegionList}
                        className={styles.widthRegionSet}
                    />
                </div>

                <div className={styles.secondRow}>
                    <SelectField
                        label={'Deployment model'}
                        isClearable={false}
                        defaultValue={
                            selectedManualDeploymentModel
                                ? selectedManualDeploymentModel
                                : [generateDeploymentModelList[0]]
                        }
                        onChange={(selectedOptions: any): void => {
                            dispatch(setSelectedDeploymentModelForManualTCO(selectedOptions));
                        }}
                        isSearchable={generateDeploymentModelList.length > 5}
                        options={generateDeploymentModelList}
                        className={styles.deploymentModelWidth}
                    />

                    <SelectField
                        label={'SQL server edition'}
                        isClearable={false}
                        defaultValue={
                            selectedManualServerEdition ? selectedManualServerEdition : [generateSQLEditionList[0]]
                        }
                        onChange={(selectedOptions: any): void => {
                            dispatch(setSelectedManualServerEdition(selectedOptions));
                        }}
                        isSearchable={generateSQLEditionList.length > 5}
                        options={generateSQLEditionList}
                        className={styles.deploymentModelWidth}
                    />
                </div>

                <div className={styles.secondRow}>
                    <TextField
                        label={GENERAL.NUMBER_OF_CLONED_COPIES}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            dispatch(setNumberOfClonedCopies(numVal));
                        }}
                        value={numberOfClonedCopies}
                        className={styles.deploymentModelWidth}
                        error={errorForClonedCopiesCount()}
                    />

                    <TextField
                        label={GENERAL.MONTHLY_DATA_CHANGE_RATE}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            dispatch(setMonthlyChangeRate(numVal));
                        }}
                        value={monthlyChangeRate ? monthlyChangeRate : ''}
                        className={styles.deploymentModelWidth}
                        info={GENERAL.MONTHLY_CHANGE_RATE_TOOLTIP}
                        error={errorForChangeRate()}
                    />
                </div>

                <div className={styles.secondRow}>
                    <TextField
                        label={'Monthly SQL BYOL costs($)'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            dispatch(setSelectedMonthlyBYOLCost(e.target.value));
                        }}
                        isOptional={true}
                        value={monthlyBYOLCost}
                        className={styles.deploymentModelWidth}
                    />
                </div>
            </div>
        </div>
    );
};

export default ManualTCOFields;
