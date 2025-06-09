import { DsTypography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import styles from './ManualVolumeTypes.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setSecondaryVolumeFilledStatus,
    setSelectedVolumeTabForSecondary
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import ManualTCOInputComponent from './ManualTCOInputComponent';
import { allPropertiesHaveValues, calculateTotalVolumes } from '../savingsUtil';

const SecondaryManualVolType = () => {
    const dispatch = useDispatch();
    const { selectedVolumeTabForSecondary, manualTCOVolumeTypes2 } = useAppSelector(state => state.exploreSavings);

    const [volumesFilled, setVolumesFilled] = useState(0);
    const [totalVolumes, setTotalVolumes] = useState(0);

    useEffect(() => {
        const io1Complete = allPropertiesHaveValues({
            manualTCONumberOfVolumes: manualTCOVolumeTypes2?.io1?.manualTCONumberOfVolumes,
            manualTCOStorageAmount: manualTCOVolumeTypes2?.io1?.manualTCOStorageAmount,
            manualTCOProvisionedIOPS: manualTCOVolumeTypes2?.io1?.manualTCOProvisionedIOPS
        });
        const io2Complete = allPropertiesHaveValues({
            manualTCONumberOfVolumes: manualTCOVolumeTypes2?.io2?.manualTCONumberOfVolumes,
            manualTCOStorageAmount: manualTCOVolumeTypes2?.io2?.manualTCOStorageAmount,
            manualTCOProvisionedIOPS: manualTCOVolumeTypes2?.io2?.manualTCOProvisionedIOPS
        });
        const gp2Complete = allPropertiesHaveValues({
            manualTCONumberOfVolumes: manualTCOVolumeTypes2?.gp2?.manualTCONumberOfVolumes,
            manualTCOStorageAmount: manualTCOVolumeTypes2?.gp2?.manualTCOStorageAmount
        });
        const gp3Complete = allPropertiesHaveValues(manualTCOVolumeTypes2?.gp3);
        const st1Complete = allPropertiesHaveValues({
            manualTCONumberOfVolumes: manualTCOVolumeTypes2?.st1?.manualTCONumberOfVolumes,
            manualTCOStorageAmount: manualTCOVolumeTypes2?.st1?.manualTCOStorageAmount
        });
        const result = io1Complete + io2Complete + gp2Complete + gp3Complete + st1Complete;

        setVolumesFilled(result);
        if (result > 0) {
            dispatch(setSecondaryVolumeFilledStatus(true));
            setTotalVolumes(
                calculateTotalVolumes(
                    io1Complete,
                    io2Complete,
                    gp2Complete,
                    gp3Complete,
                    st1Complete,
                    manualTCOVolumeTypes2
                )
            );
        } else {
            dispatch(setSecondaryVolumeFilledStatus(false));
            setTotalVolumes(0);
        }
    }, [manualTCOVolumeTypes2]);

    const handleSelect = (value: string) => {
        dispatch(setSelectedVolumeTabForSecondary(value));
    };
    return (
        <div className={styles.manualVolumeTypes}>
            <div className={styles.volSection}>
                <DsTypography variant="Semibold_14">Volume Types</DsTypography>
                <DsTypography variant="Regular_14">(Total volumes: {totalVolumes})</DsTypography>
            </div>
            <DsTypography variant="Regular_14" className={styles.subText}>
                At least one volume type should be filled.
            </DsTypography>

            <div className={styles.overviewTabsVolumeType}>
                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTabForSecondary === 'gp2'
                            ? `${styles.headerPart1} ${styles.active}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('gp2')}
                >
                    gp2
                </DsTypography>

                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTabForSecondary === 'gp3'
                            ? `${styles.headerPart1} ${styles.active}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('gp3')}
                >
                    gp3
                </DsTypography>

                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTabForSecondary === 'io1'
                            ? `${styles.headerPart1} ${styles.active}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('io1')}
                >
                    io1
                </DsTypography>
                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTabForSecondary === 'io2'
                            ? `${styles.headerPart1} ${styles.active}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('io2')}
                >
                    io2
                </DsTypography>

                <DsTypography
                    variant="Regular_14"
                    className={
                        selectedVolumeTabForSecondary === 'st1'
                            ? `${styles.headerPart1} ${styles.active}`
                            : `${styles.headerPart1}`
                    }
                    onClick={() => handleSelect('st1')}
                >
                    st1
                </DsTypography>
            </div>

            <div className={styles.contentContainer}>
                {selectedVolumeTabForSecondary === 'io2' && <ManualTCOInputComponent type="io2" throughPutDisable />}
                {selectedVolumeTabForSecondary === 'io1' && <ManualTCOInputComponent type="io1" throughPutDisable />}
                {selectedVolumeTabForSecondary === 'gp2' && (
                    <ManualTCOInputComponent type="gp2" throughPutDisable IOPSDisable />
                )}
                {selectedVolumeTabForSecondary === 'gp3' && <ManualTCOInputComponent type="gp3" />}
                {selectedVolumeTabForSecondary === 'st1' && (
                    <ManualTCOInputComponent type="st1" throughPutDisable IOPSDisable />
                )}
            </div>
        </div>
    );
};

export default SecondaryManualVolType;
