import React from 'react';
import styles from './StorageSavings.module.scss';
import { Typography } from '@netapp/design-system';
import SquareComponent from '../SquareComponent/SquareComponent';

const StorageSavings = () => {
    return (
        <div className={styles.storageSaving}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16">Storage savings</Typography>
                <Typography variant="Semibold_20" style={{ lineHeight: 'unset' }}>
                    82%
                </Typography>
            </div>

            <div className={styles.mainSection}>
                {/* Progress Bar */}
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar}`}
                        style={{
                            width: `30%`,
                            backgroundColor: '#A815F3'
                        }}
                    ></div>
                    <div className={styles.separator}></div>
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `70%`,
                            backgroundColor: '#68C6B3'
                        }}
                    ></div>
                </div>
                {/* Ends here */}

                <div className={styles.bottomSection}>
                    <SquareComponent value="0.18 Tib" color="#a815f3" text={'Storage Consumes'} />
                    <div className={styles.storageSeparator} />
                    <SquareComponent value="0.82 Tib" color="#68C6B3" text={'Storage Savings'} />
                </div>
            </div>
        </div>
    );
};

export default StorageSavings;
