import React from 'react';
import styles from './StorageSavings.module.scss';
import { Typography } from '@netapp/design-system';
import SquareComponent from '../SquareComponent/SquareComponent';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { formatFractionalNumber } from '../../../utils/utilityFunctions';

const StorageSavings = () => {
    
    const hostData = useAppSelector(state => state.databaseHome.aggregatedStorageSavings);

    return (
        <div className={styles.storageSaving}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16">{GENERAL.DB_HOST_STORAGE_SAVINGS}</Typography>
                <Typography variant="Semibold_20" style={{ lineHeight: 'unset' }}>
                    {formatFractionalNumber(hostData?.storageSavingsPercent)}%
                </Typography>
            </div>

            <div className={styles.mainSection}>
                {/* Progress Bar */}
                <div className={styles.progressBar}>
                    {hostData?.storageSavingsPercent !== 0 && 
                    <>
                        <div
                            className={`${styles.progress} ${styles.leftCurveBar}`}
                            style={{
                                width: `${100 - (hostData?.storageSavingsPercent || 0)}%`,
                                backgroundColor: '#A815F3'
                            }}
                        ></div><div className={styles.separator}></div><div
                            className={`${styles.progress} ${styles.rightCurveBar}`}
                            style={{
                                width: `${hostData?.storageSavingsPercent}%`,
                                backgroundColor: '#68C6B3'
                            }}
                        ></div>
                    </>
                    }
                </div>
                {/* Ends here */}

                <div className={styles.bottomSection}>
                    <SquareComponent value={hostData?.storageConsumes + ' TiB'} color="#a815f3" text={'Storage Consumes'} />
                    <div className={styles.storageSeparator} />
                    <SquareComponent value={hostData?.storageSavings + ' TiB'} color="#68C6B3" text={'Storage Savings'} />
                </div>
            </div>
        </div>
    );
};

export default StorageSavings;
