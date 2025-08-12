import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import styles from './ProtectedDatabases.module.scss';
import ProgressBar from '../../../../../common/ProgressBar/ProgressBar';
import { useAppSelector } from '../../../../../store/storeHooks';
import { getAggrProtection } from '../../../../../utils/utilityFunctions';

const ProtectedDatabases = () => {
    const { databaseList, databaseListLoading } = useAppSelector(state => state.workloadFactoryResource);
    const { t } = useTranslation();

    const protectionData = useMemo(() => getAggrProtection(databaseList), [databaseList]);
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
                        <DsTypography variant="Semibold_14">
                            {t('databases.resource-overview.local-protection')}
                        </DsTypography>
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
                        <ProgressBar color="var(--chart-4)" value={protectionData?.protectedPercent} />
                    </div>
                </div>

                <div className={styles.barContainer}>
                    <div className={styles.valueSection}>
                        <DsTypography variant="Semibold_14">
                            {t('databases.resource-overview.remote-protection')}
                        </DsTypography>

                        <div className={styles.count}>
                            <DsTypography variant="Regular_20">{protectionData?.crrEnabled}</DsTypography>
                            <DsTypography variant="Regular_14">out of</DsTypography>
                            <DsTypography variant="Regular_20">
                                {protectionData.protectedDb + protectionData.unprotectedDb}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.barSection}>
                        <ProgressBar color="var(--chart-4)" value={protectionData?.crrEnabledPercent || 0} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProtectedDatabases;
