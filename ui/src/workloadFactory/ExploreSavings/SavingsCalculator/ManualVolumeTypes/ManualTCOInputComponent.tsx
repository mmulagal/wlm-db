import { DsTextField, DsTypography, Popover, TextField } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ManualTCOInputComponent.module.scss';
import {
    setSecondaryVolumeTypeOperation,
    setVolumeTypeOperation
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

type ManualInputs = {
    type: string;
    throughPutDisable?: boolean;
    IOPSDisable?: boolean;
    from?: string;
    printState?: boolean;
};

const ManualTCOInputComponent = ({
    type,
    throughPutDisable = false,
    IOPSDisable = false,
    from,
    printState = false
}: ManualInputs) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { manualTCOVolumeTypes, manualTCOVolumeTypes2 } = useAppSelector(state => state.exploreSavings);

    const [volumeValue, setVolumeValue] = useState<any>(null);
    const defaultVolumeVal =
        from === 'primary'
            ? manualTCOVolumeTypes?.[type]?.manualTCONumberOfVolumes
            : manualTCOVolumeTypes2?.[type]?.manualTCONumberOfVolumes;

    const [storageAmountValue, setStorageAmountValue] = useState<any>(null);
    const defaultStorageAmountValue =
        from === 'primary'
            ? manualTCOVolumeTypes?.[type]?.manualTCOStorageAmount
            : manualTCOVolumeTypes2?.[type]?.manualTCOStorageAmount;
    const [volumeSearch, setVolumeSearch] = useSearchDebounce(500);
    // Storage amount debounce logic

    const [storageAmountSearch, setStorageAmountSearch] = useSearchDebounce(500);

    const [iopsValue, setIOPSValue] = useState<any>(null);
    const defaultIOPSValue =
        from === 'primary'
            ? manualTCOVolumeTypes?.[type]?.manualTCOProvisionedIOPS
            : manualTCOVolumeTypes2?.[type]?.manualTCOProvisionedIOPS;

    const [iopsSearch, setIOPSSearch] = useSearchDebounce(300);

    const [throughputValue, setThroughputValue] = useState<any>(null);

    const defaultThroughputValue =
        from === 'primary'
            ? manualTCOVolumeTypes?.[type]?.manualTCOThroughput
            : manualTCOVolumeTypes2?.[type]?.manualTCOThroughput;

    const [throughputSearch, setThroughputSearch] = useSearchDebounce(300);

    // use effect for volume details
    useEffect(() => {
        setVolumeSearch(volumeValue === null ? defaultVolumeVal : volumeValue);
    }, [volumeValue]);

    useEffect(() => {
        if (from === 'primary') {
            dispatch(
                setVolumeTypeOperation({
                    type,
                    mode: 'manualTCONumberOfVolumes',
                    value: volumeSearch === null ? manualTCOVolumeTypes?.[type]?.manualTCONumberOfVolumes : volumeSearch
                })
            );
        } else {
            dispatch(
                setSecondaryVolumeTypeOperation({
                    type,
                    mode: 'manualTCONumberOfVolumes',
                    value:
                        volumeSearch === null ? manualTCOVolumeTypes2?.[type]?.manualTCONumberOfVolumes : volumeSearch
                })
            );
        }
    }, [volumeSearch]);

    // use effect for volume details
    useEffect(() => {
        setStorageAmountSearch(storageAmountValue === null ? defaultStorageAmountValue : storageAmountValue);
    }, [storageAmountValue]);

    useEffect(() => {
        if (from === 'primary') {
            dispatch(
                setVolumeTypeOperation({
                    type,
                    mode: 'manualTCOStorageAmount',
                    value:
                        storageAmountSearch === null
                            ? manualTCOVolumeTypes?.[type]?.manualTCOStorageAmount
                            : storageAmountSearch
                })
            );
        } else {
            dispatch(
                setSecondaryVolumeTypeOperation({
                    type,
                    mode: 'manualTCOStorageAmount',
                    value:
                        storageAmountSearch === null
                            ? manualTCOVolumeTypes2?.[type]?.manualTCOStorageAmount
                            : storageAmountSearch
                })
            );
        }
    }, [storageAmountSearch]);

    // iops debounce details
    useEffect(() => {
        setIOPSSearch(iopsValue === null ? defaultIOPSValue : iopsValue);
    }, [iopsValue]);

    useEffect(() => {
        if (from === 'primary') {
            dispatch(
                setVolumeTypeOperation({
                    type,
                    mode: 'manualTCOProvisionedIOPS',
                    value: iopsSearch === null ? manualTCOVolumeTypes?.[type]?.manualTCOProvisionedIOPS : iopsSearch
                })
            );
        } else {
            dispatch(
                setSecondaryVolumeTypeOperation({
                    type,
                    mode: 'manualTCOProvisionedIOPS',
                    value: iopsSearch === null ? manualTCOVolumeTypes2?.[type]?.manualTCOProvisionedIOPS : iopsSearch
                })
            );
        }
    }, [iopsSearch]);

    // throughput debounce details
    useEffect(() => {
        setThroughputSearch(throughputValue === null ? defaultThroughputValue : throughputValue);
    }, [throughputValue]);

    useEffect(() => {
        if (from === 'primary') {
            dispatch(
                setVolumeTypeOperation({
                    type,
                    mode: 'manualTCOThroughput',
                    value:
                        throughputSearch === null ? manualTCOVolumeTypes?.[type]?.manualTCOThroughput : throughputSearch
                })
            );
        } else {
            dispatch(
                setSecondaryVolumeTypeOperation({
                    type,
                    mode: 'manualTCOThroughput',
                    value:
                        throughputSearch === null
                            ? manualTCOVolumeTypes2?.[type]?.manualTCOThroughput
                            : throughputSearch
                })
            );
        }
    }, [throughputSearch]);

    const handleIOPSError = () => {
        if (from === 'primary') {
            if (type === 'gp3') {
                const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOProvisionedIOPS;

                if (primaryVol > 0 && (primaryVol < 3000 || primaryVol > 16000)) {
                    return 'IOPS must be between 3000 and 16000.';
                }
            }

            if (type === 'io1') {
                const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOProvisionedIOPS;

                if (primaryVol > 0 && (primaryVol < 100 || primaryVol > 64000)) {
                    return 'IOPS must be between 100 and 64000.';
                }
            }

            if (type === 'io2') {
                const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOProvisionedIOPS;

                if (primaryVol > 0 && (primaryVol < 100 || primaryVol > 256000)) {
                    return 'IOPS must be between 100 and 256000.';
                }
            }
        }

        if (from !== 'primary') {
            if (type === 'gp3') {
                const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOProvisionedIOPS;
                if (secondaryVol > 0 && (secondaryVol < 3000 || secondaryVol > 16000)) {
                    return 'IOPS must be between 3000 and 16000.';
                }
            }

            if (type === 'io1') {
                const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOProvisionedIOPS;
                if (secondaryVol > 0 && (secondaryVol < 100 || secondaryVol > 64000)) {
                    return 'IOPS must be between 100 and 64000.';
                }
            }

            if (type === 'io2') {
                const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOProvisionedIOPS;
                if (secondaryVol > 0 && (secondaryVol < 100 || secondaryVol > 256000)) {
                    return 'IOPS must be between 100 and 256000.';
                }
            }
        }

        return '';
    };

    const handleThroughputError = () => {
        const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOThroughput;
        const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOThroughput;
        if (from === 'primary') {
            if (type === 'gp3') {
                if (primaryVol > 0 && (primaryVol < 125 || primaryVol > 1000)) {
                    return 'Throughput must be between 125 and 1000.';
                }
            }
        }
        if (from !== 'primary') {
            if (type === 'gp3') {
                if (secondaryVol > 0 && (secondaryVol < 125 || secondaryVol > 1000)) {
                    return 'Throughput must be between 125 and 1000.';
                }
            }
        }

        return '';
    };

    const handleVolumeError = () => {
        const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCONumberOfVolumes;
        const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCONumberOfVolumes;
        if (from === 'primary') {
            if (primaryVol > 0 && primaryVol > 1000000000) {
                return 'Maximum value is 1000000000';
            }
        }

        if (from !== 'primary') {
            if (secondaryVol > 0 && secondaryVol > 1000000000) {
                return 'Maximum value is 1000000000';
            }
        }
    };

    const handleStorageCapacityLimit = () => {
        const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOStorageAmount;
        const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOStorageAmount;
        if (from === 'primary') {
            if (type === 'io2') {
                if (primaryVol > 0) {
                    if (primaryVol > 65536) {
                        return 'Maximum capacity allowed: 64 TiB.';
                    }

                    if (primaryVol < 4) {
                        return 'Minimum capacity allowed: 4 GiB.';
                    }
                }
            }
            if (type === 'st1') {
                if (primaryVol > 0) {
                    if (primaryVol < 125) {
                        return 'Minimum capacity allowed: 125 GiB.';
                    }
                    if (primaryVol > 16384) {
                        return 'Maximum capacity allowed: 16 TiB.';
                    }
                }
            }

            if (primaryVol > 0 && primaryVol > 16384) {
                return 'Maximum capacity allowed: 16 TiB.';
            }
        }
        if (from !== 'primary') {
            if (type === 'io2') {
                if (secondaryVol > 0 && secondaryVol > 65536) {
                    return 'Maximum capacity allowed: 64 TiB.';
                }
            }
            if (type !== 'io2') {
                if (secondaryVol > 0 && secondaryVol > 16384) {
                    return 'Maximum capacity allowed: 16 TiB.';
                }
            }
        }

        return '';
    };

    const displayVolumeValue = volumeValue === null ? defaultVolumeVal : volumeValue;
    const displayStorageValue = storageAmountValue === null ? defaultStorageAmountValue : storageAmountValue;
    const displayIopsValue = iopsValue === null ? defaultIOPSValue : iopsValue;
    const displayThroughputValue = throughputValue === null ? defaultThroughputValue : throughputValue;

    return (
        <div className={styles.mainSection}>
            <div className={styles.row}>
                {!printState && (
                    <TextField
                        label={t('databases.explore-savings.number-of-volumes')}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            setVolumeValue(numVal);
                        }}
                        value={displayVolumeValue}
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                        error={handleVolumeError()}
                    />
                )}
                {printState && (
                    <div className={`${CommonStyles.mockInputClone} ${styles.deploymentModelWidth}`}>
                        <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                            {t('databases.explore-savings.number-of-volumes')}
                        </DsTypography>
                        <div className={CommonStyles.inputField}>{displayVolumeValue}</div>
                    </div>
                )}

                {!printState && (
                    <TextField
                        label={t('databases.explore-savings.storage-amount-per-volume')}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            setStorageAmountValue(numVal);
                        }}
                        value={displayStorageValue}
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                        info={
                            type === 'io2'
                                ? t('databases.explore-savings.storage-max-capacity-io2')
                                : t('databases.explore-savings.storage-max-capacity-default')
                        }
                        error={handleStorageCapacityLimit()}
                    />
                )}
                {printState && (
                    <div className={`${CommonStyles.mockInputClone} ${styles.deploymentModelWidth}`}>
                        <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                            {t('databases.explore-savings.storage-amount-per-volume')}
                        </DsTypography>
                        <div className={CommonStyles.inputField}>{displayStorageValue}</div>
                    </div>
                )}
            </div>

            <div className={styles.row}>
                {!printState && !IOPSDisable && (
                    <TextField
                        label={t('databases.explore-savings.provisioned-iops-per-volume')}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            setIOPSValue(numVal);
                        }}
                        isDisabled={IOPSDisable}
                        value={displayIopsValue}
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                        error={handleIOPSError()}
                    />
                )}
                {!printState && IOPSDisable && (
                    <DsTextField
                        title={t('databases.explore-savings.provisioned-iops-per-volume')}
                        disabledReason={t('databases.explore-savings.iops-disabled-tooltip')}
                        isDisabled
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                    />
                )}
                {printState && (
                    <div
                        className={`${CommonStyles.mockInputClone} ${styles.deploymentModelWidth} ${
                            IOPSDisable ? styles.mockDisabled : ''
                        }`}
                    >
                        <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                            {t('databases.explore-savings.provisioned-iops-per-volume')}
                        </DsTypography>
                        <div className={CommonStyles.inputField}>{IOPSDisable ? '' : displayIopsValue}</div>
                    </div>
                )}

                {!printState && !throughPutDisable && (
                    <TextField
                        label={t('databases.explore-savings.throughput-mbs-label')}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            setThroughputValue(numVal);
                        }}
                        isDisabled={throughPutDisable}
                        value={displayThroughputValue}
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                        error={handleThroughputError()}
                    />
                )}
                {!printState && throughPutDisable && (
                    <DsTextField
                        title={t('databases.explore-savings.throughput-mbs-label')}
                        disabledReason={t('databases.explore-savings.throughput-disabled-tooltip')}
                        isDisabled
                        className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                    />
                )}
                {printState && (
                    <div
                        className={`${CommonStyles.mockInputClone} ${styles.deploymentModelWidth} ${
                            throughPutDisable ? styles.mockDisabled : ''
                        }`}
                    >
                        <DsTypography variant="Regular_14" className={CommonStyles.mockLabel}>
                            {t('databases.explore-savings.throughput-mbs-label')}
                        </DsTypography>
                        <div className={CommonStyles.inputField}>{throughPutDisable ? '' : displayThroughputValue}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManualTCOInputComponent;
