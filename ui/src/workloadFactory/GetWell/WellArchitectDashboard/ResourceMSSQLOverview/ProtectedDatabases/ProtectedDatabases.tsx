import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './ProtectedDatabases.module.scss';
import ProgressBar from '../../../../../common/ProgressBar/ProgressBar';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useMemo } from 'react';
import { getAggrProtection } from '../../../../../utils/utilityFunctions';

const ProtectedDatabases = () => {
    const { databaseList, databaseListLoading } = useAppSelector(state => state.workloadFactoryResource);

    const protectionData = useMemo(() => {
        return getAggrProtection(databaseList);
    }, [databaseList]);
    return (
        <div className={styles.protectedDatabases}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Protected databases
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                <div className={styles.barContainer}>
                    <div className={styles.valueSection}>
                        <DsTypography variant="Semibold_14">Local protection (snapshots)</DsTypography>
                        <div className={styles.count}>
                            {!databaseListLoading && (
                                <>
                                    <DsTypography variant="Regular_20">{protectionData.protectedDb}</DsTypography>
                                    <DsTypography variant="Regular_14">out of</DsTypography>
                                    <DsTypography variant="Regular_20">
                                        {protectionData.protectedDb + protectionData.unprotectedDb}
                                    </DsTypography>{' '}
                                </>
                            )}

                            {databaseListLoading && <DsFlashingDotsLoader />}
                        </div>
                    </div>

                    <div className={styles.barSection}>
                        <ProgressBar color={'var(--chart-4)'} value={protectionData?.protectedPercent} />
                    </div>
                </div>

                <div className={styles.barContainer}>
                    <div className={styles.valueSection}>
                        <DsTypography variant="Semibold_14">Remote protection (replicated volumes)</DsTypography>
                        {/* <div className={styles.count}>
                            <DsTypography variant="Regular_20">9</DsTypography>
                            <DsTypography variant="Regular_14">out of</DsTypography>
                            <DsTypography variant="Regular_20">10</DsTypography>
                        </div> */}
                    </div>

                    <div className={styles.barSection}>
                        <ProgressBar color={'var(--chart-4)'} value={0} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProtectedDatabases;
