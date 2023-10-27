import React from 'react';
import styles from './StorageSavings.module.scss';
import { Typography } from '@netapp/design-system';
import SquareComponent from '../SquareComponent/SquareComponent';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { formatFractionalNumber } from '../../../utils/utilityFunctions';
import LoadingComponent from '../../../common/LoadingConponent/LoadingComponent';

const StorageSavings = () => {
    const hostData = useAppSelector(state => state.databaseHome.aggregatedStorageSavings);
    const { databaseHostsLoading } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { databaseJobsLoading } = useAppSelector(state => state.databaseHome.getDatabaseJobs);

    return (
        <div className={styles.storageSaving}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.DB_HOST_STORAGE_SAVINGS}
                    {(databaseHostsLoading || databaseJobsLoading) && (
                        <div className={styles.loadingPlacement}>
                            <LoadingComponent />
                        </div>
                    )}
                </Typography>
                <Typography variant="Semibold_20" style={{ lineHeight: 'unset' }}>
                    {formatFractionalNumber(hostData?.storageSavingsPercent, 2)}%
                </Typography>
            </div>

            <div className={styles.mainSection}>
                {/* Progress Bar */}
                <div className={styles.progressBar}>
                    {hostData?.storageSavingsPercent !== 0 && (
                        <>
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar}`}
                                style={{
                                    width: `${100 - (hostData?.storageSavingsPercent || 0)}%`,
                                    backgroundColor: 'var(--chart-9)'
                                }}
                            ></div>
                            <div className={styles.separator}></div>
                            <div
                                className={`${styles.progress} ${styles.rightCurveBar}`}
                                style={{
                                    width: `${hostData?.storageSavingsPercent}%`,
                                    backgroundColor: 'var(--chart-4)'
                                }}
                            ></div>
                        </>
                    )}

                    {hostData?.storageSavingsPercent === 0 && (
                        <>
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                                style={{
                                    width: `${100}%`,
                                    backgroundColor: 'var(--chart-disabled)'
                                }}
                            ></div>
                        </>
                    )}
                </div>
                {/* Ends here */}

                <div className={styles.bottomSection}>
                    <SquareComponent
                        value={hostData?.storageConsumes || GENERAL.NOT_AVAILABLE}
                        color="var(--chart-9)"
                        text={'Storage Consumes'}
                    />
                    <div className={styles.storageSeparator} />
                    <SquareComponent
                        value={hostData?.storageSavings || GENERAL.NOT_AVAILABLE}
                        color="var(--chart-4)"
                        text={'Storage Savings'}
                    />
                </div>
            </div>
        </div>
    );
};

export default StorageSavings;
