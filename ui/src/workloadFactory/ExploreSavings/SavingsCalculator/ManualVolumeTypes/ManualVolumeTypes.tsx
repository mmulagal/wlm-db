import { DsTypography, TextField } from '@netapp/design-system';
import styles from './ManualVolumeTypes.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import {
    setSelectedManualTCONumberOfVolumes,
    setSelectedManualTCOProvisionedIOPS,
    setSelectedManualTCOStorageAmount,
    setSelectedManualTCOThroughput,
    setSelectedVolumeType
} from '../../../../store/workloadFactory/exploreSavingsSlice';

const ManualVolumeTypes = () => {
    const dispatch = useDispatch();
    const {
        selectedVolumeTab,
        manualTCONumberOfVolumes,
        manualTCOStorageAmount,
        manualTCOProvisionedIOPS,
        manualTCOThroughput
    } = useAppSelector(state => state.exploreSavings);

    const handleSelect = (value: string) => {
        dispatch(setSelectedVolumeType(value));
    };
    return (
        <div className={styles.manualVolumeTypes}>
            <DsTypography variant="Semibold_14">Volume Types</DsTypography>
            <DsTypography variant="Regular_14" className={styles.subText}>
                At least one volume type should be filled.
            </DsTypography>

            <div className={styles.overviewTabsVolumeType}>
                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTab === 'io2' ? `${styles.headerPart1} ${styles.active}` : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('io2')}
                >
                    io2
                </DsTypography>

                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTab === 'gp2' ? `${styles.headerPart1} ${styles.active}` : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('gp2')}
                >
                    gp2
                </DsTypography>

                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTab === 'gp3' ? `${styles.headerPart1} ${styles.active}` : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('gp3')}
                >
                    gp3
                </DsTypography>

                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTab === 'io1' ? `${styles.headerPart1} ${styles.active}` : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('io1')}
                >
                    io1
                </DsTypography>

                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTab === 'st1' ? `${styles.headerPart1} ${styles.active}` : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('st1')}
                >
                    st1
                </DsTypography>
            </div>

            <div className={styles.contentContainer}>
                {selectedVolumeTab === 'io2' && (
                    <div className={styles.mainSection}>
                        <div className={styles.row}>
                            <TextField
                                label={'Number of volumes'}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                    dispatch(setSelectedManualTCONumberOfVolumes(numVal));
                                }}
                                value={manualTCONumberOfVolumes}
                                className={styles.deploymentModelWidth}
                            />

                            <TextField
                                label={'Storage amount per volume (GiB)'}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                    dispatch(setSelectedManualTCOStorageAmount(numVal));
                                }}
                                value={manualTCOStorageAmount}
                                className={styles.deploymentModelWidth}
                            />
                        </div>

                        {/* Second Row */}
                        <div className={styles.row}>
                            <TextField
                                label={'Provisioned IOPS per volume'}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                    dispatch(setSelectedManualTCOProvisionedIOPS(numVal));
                                }}
                                value={manualTCOProvisionedIOPS}
                                className={styles.deploymentModelWidth}
                            />

                            <TextField
                                label={'Throughput MB/s-default'}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                    dispatch(setSelectedManualTCOThroughput(numVal));
                                }}
                                value={manualTCOThroughput}
                                className={styles.deploymentModelWidth}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManualVolumeTypes;
