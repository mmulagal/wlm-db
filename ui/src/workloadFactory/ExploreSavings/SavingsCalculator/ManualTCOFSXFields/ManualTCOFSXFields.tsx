import { DsTypography, SelectField, TextField } from '@netapp/design-system';
import { useEffect, useMemo, useState } from 'react';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { useDispatch } from 'react-redux';
import styles from './ManualTCOFSXFields.module.scss';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import {
    setSelectedManualDeploymentType,
    setSelectedManualStorageCapacity,
    setSelectedManualStorageCapacityUnit,
    setSelectedManualStorageType,
    setSelectedManualFSXIOPS,
    setSelectedManualFSXThroughput
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';
import { TCO_MANUAL_DEPLOYMENT_TYPE } from '../../../../utils/consts';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

interface ManualTCOFSXFieldsProps {
    printState: boolean;
}

const ManualTCOFSXFields = ({ printState }: ManualTCOFSXFieldsProps) => {
    const dispatch = useDispatch();
    const {
        selectedManualDeploymentType,
        selectedManualDeploymentModel,
        selectedManualStorageType,
        selectedManualStorageCapacityUnit,
        manualStorageCapacity,
        selectedManualFSXIOPS,
        selectedManualFSXThroughput
    } = useAppSelector(state => state.exploreSavings);

    const [textSearch, setTextSearch] = useSearchDebounce(500);

    const [storageCapacity, setStorageCapacity] = useState<any>(manualStorageCapacity);

    // Use effect for machine description
    useEffect(() => {
        setTextSearch(storageCapacity);
    }, [storageCapacity]);

    useEffect(() => {
        dispatch(setSelectedManualStorageCapacity(textSearch));
    }, [textSearch]);

    // IOPS Debounce code

    const [iopsSearch, setIOPSSearch] = useSearchDebounce(300);

    const [iopsValue, setIOPSValue] = useState<any>(selectedManualFSXIOPS);

    // Use effect for machine description
    useEffect(() => {
        setIOPSSearch(iopsValue);
    }, [iopsValue]);

    useEffect(() => {
        dispatch(setSelectedManualFSXIOPS(iopsSearch));
    }, [iopsSearch]);

    // Throughput Debounce code

    const [throughputSearch, setThroughputSearch] = useSearchDebounce(300);

    const [throughputValue, setThroughputValue] = useState<any>(selectedManualFSXThroughput);

    // Use effect for machine description
    useEffect(() => {
        setThroughputSearch(throughputValue);
    }, [throughputValue]);

    useEffect(() => {
        dispatch(setSelectedManualFSXThroughput(throughputSearch));
    }, [throughputSearch]);

    // to generate deployment type
    const generateDeploymentTypeList = useMemo<optionType[]>((): optionType[] => {
        const deploymentModel = [TCO_MANUAL_DEPLOYMENT_TYPE.SINGLE, TCO_MANUAL_DEPLOYMENT_TYPE.MULTI];

        const options: optionType[] = [];
        deploymentModel?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        if (selectedManualDeploymentModel?.label === 'FCI') {
            dispatch(setSelectedManualDeploymentType(generateDeploymentTypeList[1]));
        } else {
            dispatch(setSelectedManualDeploymentType(generateDeploymentTypeList[0]));
        }
    }, [selectedManualDeploymentModel]);
    useEffect(() => {
        if (!selectedManualDeploymentType) {
            dispatch(setSelectedManualDeploymentType(generateDeploymentTypeList[0]));
        }
    }, [generateDeploymentTypeList]);

    // to generate Storage type
    const generateStorageTypeList = useMemo<optionType[]>((): optionType[] => {
        const deploymentModel = ['SSD'];

        const options: optionType[] = [];
        deploymentModel?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        if (!selectedManualStorageType) {
            dispatch(setSelectedManualStorageType(generateStorageTypeList[0]));
        }
    }, [generateStorageTypeList]);

    // to generate Storage unit
    const generateStorageCapacityUnitList = useMemo<optionType[]>((): optionType[] => {
        const deploymentModel = ['TiB', 'GiB'];

        const options: optionType[] = [];
        deploymentModel?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '', val);
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        if (!selectedManualStorageCapacityUnit) {
            dispatch(setSelectedManualStorageCapacityUnit(generateStorageCapacityUnitList[0]));
        }
    }, [generateStorageCapacityUnitList]);

    const handleStorageCapacityError = () => {
        if (Number(storageCapacity) > 64 && selectedManualStorageCapacityUnit?.label === 'TiB') {
            return 'Maximum capacity value is 64 TiB';
        }
        return '';
    };

    const handleIOPSError = () => {
        if (Number(iopsValue) < 96 || Number(iopsValue) > 400000) {
            return 'Value should be 96 - 400,000';
        }
        return '';
    };
    const handleThroughputError = () => {
        if (Number(throughputValue) < 8 || Number(throughputValue) > 12288) {
            return 'Value should be 8-12,288 MB/s';
        }
        return '';
    };

    return (
        <div className={styles.manualTCOFSX}>
            <DsTypography variant="Semibold_14">FSx for Windows File Server settings</DsTypography>
            <div className={styles.fieldContainer}>
                <div className={styles.rowContainer}>
                    <SelectField
                        label="Deployment type"
                        isClearable={false}
                        value={selectedManualDeploymentType || [generateDeploymentTypeList[0]]}
                        onChange={(selectedOptions: any): void => {
                            dispatch(setSelectedManualDeploymentType(selectedOptions));
                        }}
                        isSearchable={generateDeploymentTypeList.length > 5}
                        options={generateDeploymentTypeList}
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                    />

                    <SelectField
                        label="Storage type"
                        isDisabled
                        isClearable={false}
                        value={selectedManualStorageType || [generateStorageTypeList[0]]}
                        onChange={(selectedOptions: any): void => {
                            dispatch(setSelectedManualStorageType(selectedOptions));
                        }}
                        isSearchable={generateStorageTypeList.length > 5}
                        options={generateStorageTypeList}
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                    />
                </div>

                {/* Second row starts here */}
                <div className={styles.rowContainer}>
                    <div className={styles.storageCapacityField}>
                        {!printState && (
                            <TextField
                                label="Total storage capacity"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                    setStorageCapacity(numVal);
                                }}
                                value={storageCapacity}
                                className={`${styles.SCWidth} savings-calculator-input-fields`}
                                error={handleStorageCapacityError()}
                            />
                        )}
                        {printState && (
                            <div className={`${CommonStyles.mockInputClone} ${styles.SCWidth}`}>
                                <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                                    Total storage capacity
                                </DsTypography>
                                <div className={CommonStyles.inputField}>{storageCapacity}</div>
                            </div>
                        )}
                        <SelectField
                            label="hide"
                            isClearable={false}
                            value={selectedManualStorageCapacityUnit || [generateStorageCapacityUnitList[0]]}
                            onChange={(selectedOptions: any): void => {
                                dispatch(setSelectedManualStorageCapacityUnit(selectedOptions));
                            }}
                            isSearchable={generateStorageCapacityUnitList.length > 5}
                            options={generateStorageCapacityUnitList}
                            className={`${styles.SCUnitWidth} savings-calculator-input-fields`}
                        />
                    </div>

                    {!printState && (
                        <TextField
                            label="Provisioned SSD IOPS"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                setIOPSValue(numVal);
                            }}
                            value={iopsValue}
                            className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                            error={handleIOPSError()}
                        />
                    )}
                    {printState && (
                        <div className={`${CommonStyles.mockInputClone} ${styles.deploymentModelWidth}`}>
                            <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                                Provisioned SSD IOPS
                            </DsTypography>
                            <div className={CommonStyles.inputField}>{iopsValue}</div>
                        </div>
                    )}
                </div>

                <div className={styles.rowContainer}>
                    {!printState && (
                        <TextField
                            label="Throughput (MB/s)"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                setThroughputValue(numVal);
                            }}
                            value={throughputValue}
                            className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                            error={handleThroughputError()}
                        />
                    )}
                    {printState && (
                        <div className={`${CommonStyles.mockInputClone} ${styles.deploymentModelWidth}`}>
                            <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                                Throughput (MB/s)
                            </DsTypography>
                            <div className={CommonStyles.inputField}>{throughputValue}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManualTCOFSXFields;
