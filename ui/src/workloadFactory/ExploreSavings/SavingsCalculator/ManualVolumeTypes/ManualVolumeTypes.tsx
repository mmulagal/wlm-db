import { DsTypography, TextField } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useEffect, useState } from 'react';
import styles from './ManualVolumeTypes.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedVolumeType, setVolumeFilledStatus } from '../../../../store/workloadFactory/exploreSavingsSlice';
import ManualTCOInputComponent from './ManualTCOInputComponent';
import { allPropertiesHaveValues, calculateTotalVolumes } from '../savingsUtil';

interface ManualVolumeTypesProps {
    printState?: boolean;
}

const ManualVolumeTypes = ({ printState = false }: ManualVolumeTypesProps) => {
    const dispatch = useDispatch();
    const { selectedVolumeTab, manualTCOVolumeTypes } = useAppSelector(state => state.exploreSavings);

    const [volumesFilled, setVolumesFilled] = useState(0);
    const [totalVolumes, setTotalVolumes] = useState(0);

    useEffect(() => {
        const io1Complete = allPropertiesHaveValues({
            manualTCONumberOfVolumes: manualTCOVolumeTypes?.io1?.manualTCONumberOfVolumes,
            manualTCOStorageAmount: manualTCOVolumeTypes?.io1?.manualTCOStorageAmount,
            manualTCOProvisionedIOPS: manualTCOVolumeTypes?.io1?.manualTCOProvisionedIOPS
        });
        const io2Complete = allPropertiesHaveValues({
            manualTCONumberOfVolumes: manualTCOVolumeTypes?.io2?.manualTCONumberOfVolumes,
            manualTCOStorageAmount: manualTCOVolumeTypes?.io2?.manualTCOStorageAmount,
            manualTCOProvisionedIOPS: manualTCOVolumeTypes?.io2?.manualTCOProvisionedIOPS
        });
        const gp2Complete = allPropertiesHaveValues({
            manualTCONumberOfVolumes: manualTCOVolumeTypes?.gp2?.manualTCONumberOfVolumes,
            manualTCOStorageAmount: manualTCOVolumeTypes?.gp2?.manualTCOStorageAmount
        });
        const gp3Complete = allPropertiesHaveValues(manualTCOVolumeTypes?.gp3);
        const st1Complete = allPropertiesHaveValues({
            manualTCONumberOfVolumes: manualTCOVolumeTypes?.st1?.manualTCONumberOfVolumes,
            manualTCOStorageAmount: manualTCOVolumeTypes?.st1?.manualTCOStorageAmount
        });
        const result = io1Complete + io2Complete + gp2Complete + gp3Complete + st1Complete;

        setVolumesFilled(result);
        if (result > 0) {
            dispatch(setVolumeFilledStatus(true));
            setTotalVolumes(
                calculateTotalVolumes(
                    io1Complete,
                    io2Complete,
                    gp2Complete,
                    gp3Complete,
                    st1Complete,
                    manualTCOVolumeTypes
                )
            );
        } else {
            setTotalVolumes(0);
            dispatch(setVolumeFilledStatus(false));
        }
    }, [manualTCOVolumeTypes]);

    const handleSelect = (value: string) => {
        dispatch(setSelectedVolumeType(value));
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
                {selectedVolumeTab === 'io2' && (
                    <ManualTCOInputComponent type="io2" throughPutDisable from="primary" printState={printState} />
                )}
                {selectedVolumeTab === 'io1' && (
                    <ManualTCOInputComponent type="io1" throughPutDisable from="primary" printState={printState} />
                )}
                {selectedVolumeTab === 'gp2' && (
                    <ManualTCOInputComponent
                        type="gp2"
                        throughPutDisable
                        IOPSDisable
                        from="primary"
                        printState={printState}
                    />
                )}
                {selectedVolumeTab === 'gp3' && (
                    <ManualTCOInputComponent type="gp3" from="primary" printState={printState} />
                )}
                {selectedVolumeTab === 'st1' && (
                    <ManualTCOInputComponent
                        type="st1"
                        throughPutDisable
                        IOPSDisable
                        from="primary"
                        printState={printState}
                    />
                )}
            </div>
        </div>
    );
};

export default ManualVolumeTypes;
