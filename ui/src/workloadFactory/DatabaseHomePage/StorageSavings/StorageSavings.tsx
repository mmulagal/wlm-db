import React from 'react';
import styles from './StorageSavings.module.scss';
import { FlashingDotsLoader, TooltipInfo, Typography } from '@netapp/design-system';
import SquareComponent from '../SquareComponent/SquareComponent';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { formatFractionalNumber } from '../../../utils/utilityFunctions';
import { ReactComponent as Bullet } from '../../../assets/ic_bullet.svg';

type StorageSavingsProps = {
    hostData: any;
    hostsLoading?: boolean;
};

const StorageSavings = ({ hostData, hostsLoading }: StorageSavingsProps) => {
    const handleProgressBar = () => {
        if (
            hostData?.storageSavingsPercent !== 0 &&
            //@ts-ignore
            hostData?.storageSavingsPercent <= 1
        ) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-9)'
                        }}
                    ></div>
                </>
            );
        }
        if (
            hostData?.storageSavingsPercent !== 0 &&
            //@ts-ignore
            hostData?.storageSavingsPercent >= 1
        ) {
            return (
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
            );
        }

        if (hostData?.storageSavingsPercent === 0) {
            return (
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    ></div>
                </>
            );
        }
    };

    return (
        <div className={styles.storageSaving}>
            <div className={styles.headSection}>
                <div className={styles.storageSavingTooltipSection}>
                    <Typography variant="Regular_16" className={styles.title}>
                        {GENERAL.DB_HOST_STORAGE_SAVINGS}
                    </Typography>
                    <TooltipInfo>
                        <div className={styles.list}>
                            <div className={styles.listItem}>
                                <Bullet />
                                <Typography variant="Regular_13" className={styles.textWidth}>
                                    {GENERAL.DB_SS_TT_1}
                                </Typography>
                            </div>
                            <div className={styles.listItem}>
                                <Bullet />
                                <Typography variant="Regular_13" className={styles.textWidth}>
                                    {GENERAL.DB_SS_TT_2}
                                </Typography>
                            </div>
                        </div>
                    </TooltipInfo>
                </div>

                {hostsLoading ? (
                    <FlashingDotsLoader />
                ) : (
                    <Typography variant="Semibold_20" style={{ lineHeight: 'unset' }}>
                        {formatFractionalNumber(hostData?.storageSavingsPercent, 2)}%
                    </Typography>
                )}
            </div>

            <div className={styles.mainSection}>
                {/* Progress Bar */}
                <div className={styles.progressBar}>{handleProgressBar()}</div>
                {/* Ends here */}

                <div className={styles.bottomSection}>
                    <SquareComponent
                        value={hostData?.storageConsumes || GENERAL.NOT_AVAILABLE}
                        color="var(--chart-9)"
                        text={'Storage Consumed'}
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
