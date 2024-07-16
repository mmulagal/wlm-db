import { DsTypography, TextField } from '@netapp/design-system';
import styles from './ManualVolumeTypes.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setSelectedVolumeType } from '../../../../store/workloadFactory/exploreSavingsSlice';
import ManualTCOInputComponent from './ManualTCOInputComponent';

const SecondaryManualVolType = () => {
    const dispatch = useDispatch();
    const { selectedVolumeTab, manualTCOVolumeTypes } = useAppSelector(state => state.exploreSavings);

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
                        selectedVolumeTab === 'io2' ? `${styles.headerPart1} ${styles.active}` : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('io2')}
                >
                    io2
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
                {selectedVolumeTab === 'io2' && <ManualTCOInputComponent type="io2" />}
                {selectedVolumeTab === 'io1' && <ManualTCOInputComponent type="io1" throughPutDisable={true} />}
                {selectedVolumeTab === 'gp2' && (
                    <ManualTCOInputComponent type="gp2" throughPutDisable={true} IOPSDisable={true} />
                )}
                {selectedVolumeTab === 'gp3' && <ManualTCOInputComponent type="gp3" />}
                {selectedVolumeTab === 'st1' && (
                    <ManualTCOInputComponent type="st1" throughPutDisable={true} IOPSDisable={true} />
                )}
            </div>
        </div>
    );
};

export default SecondaryManualVolType;
