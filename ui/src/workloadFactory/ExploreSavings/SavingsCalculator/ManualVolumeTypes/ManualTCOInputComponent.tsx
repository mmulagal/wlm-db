import { DsTextField, Popover, TextField } from '@netapp/design-system';
import styles from './ManualTCOInputComponent.module.scss';
import { useDispatch } from 'react-redux';
import {
    setSecondaryVolumeTypeOperation,
    setVolumeTypeOperation
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

type ManualInputs = {
    type: string;
    throughPutDisable?: boolean;
    IOPSDisable?: boolean;
    from?: string;
};

const ManualTCOInputComponent = ({ type, throughPutDisable = false, IOPSDisable = false, from }: ManualInputs) => {
    const dispatch = useDispatch();
    const { manualTCOVolumeTypes, manualTCOVolumeTypes2 } = useAppSelector(state => state.exploreSavings);

    const handleIOPSError = () => {
        if (type === 'gp3') {
            const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOProvisionedIOPS;
            const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOProvisionedIOPS;
            if (
                (primaryVol > 0 && (primaryVol < 3000 || primaryVol > 16000)) ||
                (secondaryVol > 0 && (secondaryVol < 3000 || secondaryVol > 16000))
            ) {
                return 'IOPS must be between 3000 and 16000.';
            }
        }

        if (type === 'io1') {
            const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOProvisionedIOPS;
            const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOProvisionedIOPS;
            if (
                (primaryVol > 0 && (primaryVol < 100 || primaryVol > 64000)) ||
                (secondaryVol > 0 && (secondaryVol < 100 || secondaryVol > 64000))
            ) {
                return 'IOPS must be between 100 and 64000.';
            }
        }

        if (type === 'io2') {
            const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOProvisionedIOPS;
            const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOProvisionedIOPS;
            if (
                (primaryVol > 0 && (primaryVol < 100 || primaryVol > 256000)) ||
                (secondaryVol > 0 && (secondaryVol < 100 || secondaryVol > 256000))
            ) {
                return 'IOPS must be between 100 and 256000.';
            }
        }
        return '';
    };

    const handleThroughputError = () => {
        if (type === 'gp3') {
            const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOThroughput;
            const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOThroughput;
            if (
                (primaryVol > 0 && (primaryVol < 125 || primaryVol > 1000)) ||
                (secondaryVol > 0 && (secondaryVol < 125 || secondaryVol > 1000))
            ) {
                return 'Throughput must be between 125 and 1000.';
            }
        }

        return '';
    };

    const handleStorageCapacityLimit = () => {
        const primaryVol = manualTCOVolumeTypes?.[type]?.manualTCOStorageAmount;
        const secondaryVol = manualTCOVolumeTypes2?.[type]?.manualTCOStorageAmount;
        if ((primaryVol > 0 && primaryVol > 16384) || (secondaryVol > 0 && secondaryVol > 16384)) {
            return 'Maximum capacity allowed: 16 TiB.';
        }
        return '';
    };
    return (
        <div className={styles.mainSection}>
            <div className={styles.row}>
                <TextField
                    label={'Number of volumes'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                        if (from === 'primary') {
                            dispatch(
                                setVolumeTypeOperation({
                                    type: type,
                                    mode: 'manualTCONumberOfVolumes',
                                    value: numVal
                                })
                            );
                        } else {
                            dispatch(
                                setSecondaryVolumeTypeOperation({
                                    type: type,
                                    mode: 'manualTCONumberOfVolumes',
                                    value: numVal
                                })
                            );
                        }
                    }}
                    value={
                        from === 'primary'
                            ? manualTCOVolumeTypes?.[type]?.manualTCONumberOfVolumes
                            : manualTCOVolumeTypes2?.[type]?.manualTCONumberOfVolumes
                    }
                    className={styles.deploymentModelWidth}
                />

                <TextField
                    label={'Storage amount per volume (GiB)'}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                        if (from === 'primary') {
                            dispatch(
                                setVolumeTypeOperation({
                                    type: type,
                                    mode: 'manualTCOStorageAmount',
                                    value: numVal
                                })
                            );
                        } else {
                            dispatch(
                                setSecondaryVolumeTypeOperation({
                                    type: type,
                                    mode: 'manualTCOStorageAmount',
                                    value: numVal
                                })
                            );
                        }
                    }}
                    value={
                        from === 'primary'
                            ? manualTCOVolumeTypes?.[type]?.manualTCOStorageAmount
                            : manualTCOVolumeTypes2?.[type]?.manualTCOStorageAmount
                    }
                    className={styles.deploymentModelWidth}
                    info="Maximum capacity allowed: 16 TiB."
                    error={handleStorageCapacityLimit()}
                />
            </div>

            {/* Second Row */}
            <div className={styles.row}>
                {IOPSDisable ? (
                    <Popover
                        popoverClass={styles['copy-popover']}
                        children={GENERAL.IOPS_DISABLE_TOOLTIP}
                        trigger="hover"
                        container={
                            <TextField
                                label={'Provisioned IOPS per volume'}
                                isDisabled={true}
                                className={styles.deploymentModelWidth}
                            />
                        }
                    />
                ) : (
                    <TextField
                        label={'Provisioned IOPS per volume'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            if (from === 'primary') {
                                dispatch(
                                    setVolumeTypeOperation({
                                        type: type,
                                        mode: 'manualTCOProvisionedIOPS',
                                        value: numVal
                                    })
                                );
                            } else {
                                dispatch(
                                    setSecondaryVolumeTypeOperation({
                                        type: type,
                                        mode: 'manualTCOProvisionedIOPS',
                                        value: numVal
                                    })
                                );
                            }
                        }}
                        isDisabled={IOPSDisable}
                        value={
                            from === 'primary'
                                ? manualTCOVolumeTypes?.[type]?.manualTCOProvisionedIOPS
                                : manualTCOVolumeTypes2?.[type]?.manualTCOProvisionedIOPS
                        }
                        className={styles.deploymentModelWidth}
                        error={handleIOPSError()}
                    />
                )}

                {throughPutDisable ? (
                    <Popover
                        popoverClass={styles['copy-popover']}
                        children={GENERAL.THROUGHPUT_DISABLE_TOOLTIP}
                        trigger="hover"
                        container={
                            <TextField
                                label={'Throughput MB/s-default'}
                                isDisabled={true}
                                className={styles.deploymentModelWidth}
                            />
                        }
                    />
                ) : (
                    <TextField
                        label={'Throughput MB/s-default'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const numVal = e.target.value.replace(/[^0-9.]/g, '');
                            if (from === 'primary') {
                                dispatch(
                                    setVolumeTypeOperation({
                                        type: type,
                                        mode: 'manualTCOThroughput',
                                        value: numVal
                                    })
                                );
                            } else {
                                dispatch(
                                    setSecondaryVolumeTypeOperation({
                                        type: type,
                                        mode: 'manualTCOThroughput',
                                        value: numVal
                                    })
                                );
                            }
                        }}
                        isDisabled={throughPutDisable}
                        value={
                            from === 'primary'
                                ? manualTCOVolumeTypes?.[type]?.manualTCOThroughput
                                : manualTCOVolumeTypes2?.[type]?.manualTCOThroughput
                        }
                        className={styles.deploymentModelWidth}
                        error={handleThroughputError()}
                    />
                )}
            </div>
        </div>
    );
};

export default ManualTCOInputComponent;
