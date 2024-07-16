import { TextField } from '@netapp/design-system';
import styles from './ManualTCOInputComponent.module.scss';
import { useDispatch } from 'react-redux';
import {
    setSecondaryVolumeTypeOperation,
    setVolumeTypeOperation
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';

type ManualInputs = {
    type: string;
    throughPutDisable?: boolean;
    IOPSDisable?: boolean;
    from?: string;
};

const ManualTCOInputComponent = ({ type, throughPutDisable = false, IOPSDisable = false, from }: ManualInputs) => {
    const dispatch = useDispatch();
    const { manualTCOVolumeTypes, manualTCOVolumeTypes2 } = useAppSelector(state => state.exploreSavings);
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
                />
            </div>

            {/* Second Row */}
            <div className={styles.row}>
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
                />

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
                />
            </div>
        </div>
    );
};

export default ManualTCOInputComponent;
