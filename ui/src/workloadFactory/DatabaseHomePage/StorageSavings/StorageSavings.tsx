import React from 'react';
import { FlashingDotsLoader, TooltipInfo, Typography } from '@netapp/design-system';
import styles from './StorageSavings.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import SquareComponent from '../SquareComponent/SquareComponent';
import { GENERAL } from '../../../utils/appConstants';
import { formatFractionalNumber } from '../../../utils/utilityFunctions';
import { ReactComponent as Bullet } from '../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../store/storeHooks';

type StorageSavingsProps = {
    hostData: any;
    hostsLoading?: boolean;
};

const StorageSavings = ({ hostData, hostsLoading }: StorageSavingsProps) => {
    const { showNA } = useAppSelector(state => state.headers);
    const handleProgressBar = () => {
        if (showNA) {
            return (
                <div
                    className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                    style={{
                        width: `${100}%`,
                        backgroundColor: 'var(--chart-disabled)'
                    }}
                />
            );
        }
        
        if (
            hostData?.storageSavingsPercent !== 0 &&
            // @ts-ignore
            hostData?.storageSavingsPercent <= 1
        ) {
            return (
                <div
                    className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                    style={{
                        width: `${100}%`,
                        backgroundColor: 'var(--chart-9)'
                    }}
                />
            );
        }
        if (
            hostData?.storageSavingsPercent !== 0 &&
            // @ts-ignore
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
                    />
                    <div className={styles.separator} />
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${hostData?.storageSavingsPercent}%`,
                            backgroundColor: 'var(--chart-4)'
                        }}
                    />
                </>
            );
        }

        if (hostData?.storageSavingsPercent === 0) {
            return (
                <div
                    className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                    style={{
                        width: `${100}%`,
                        backgroundColor: 'var(--chart-disabled)'
                    }}
                />
            );
        }
    };

    return (
        <div className={`${styles.storageSaving} ${showNA ? CommonStyles.notAvailable : ''}`}>
            <div className={styles.headSection}>
                <div className={styles.storageSavingTooltipSection}>
                    <Typography variant="Regular_16" className={styles.title}>
                        {GENERAL.DB_HOST_STORAGE_SAVINGS}
                    </Typography>
                    <TooltipInfo>
                        <div className={styles.list}>
                            <div className={styles.listItem}>
                                <Bullet />
                                <Typography variant="Regular_13" className={`${styles.textWidth} ${showNA ? CommonStyles.notAvailable : ''}`}>
                                    {GENERAL.DB_SS_TT_1}
                                </Typography>
                            </div>
                            <div className={styles.listItem}>
                                <Bullet />
                                <Typography variant="Regular_13" className={`${styles.textWidth} ${showNA ? CommonStyles.notAvailable : ''}`}>
                                    {GENERAL.DB_SS_TT_2}
                                </Typography>
                            </div>
                        </div>
                    </TooltipInfo>
                </div>

                <div className={styles.rightTopValue}>
                    <Typography variant="Semibold_20" style={{ lineHeight: 'unset' }} className={showNA ? CommonStyles.notAvailable : ''}>
                        {showNA ? GENERAL.NOT_AVAILABLE : `${formatFractionalNumber(hostData?.storageSavingsPercent, 2)}%`}
                    </Typography>
                    {hostsLoading && <FlashingDotsLoader />}
                </div>
            </div>

            <div className={styles.mainSection}>
                {/* Progress Bar */}
                <div className={styles.progressBar}>{handleProgressBar()}</div>
                {/* Ends here */}

                <div className={styles.bottomSection}>
                    <SquareComponent
                        value={showNA ? GENERAL.NOT_AVAILABLE : (hostData?.storageConsumes || GENERAL.NOT_AVAILABLE)}
                        color="var(--chart-9)"
                        text="Consumed storage"
                        loadingInFirstRow={hostsLoading}
                        isSmall
                        isDisabled={showNA}
                    />
                    <div className={styles.storageSeparator} />
                    <SquareComponent
                        value={showNA ? GENERAL.NOT_AVAILABLE : (hostData?.storageSavings || GENERAL.NOT_AVAILABLE)}
                        color="var(--chart-4)"
                        text="Storage Savings"
                        loadingInFirstRow={hostsLoading}
                        isSmall
                        isDisabled={showNA}
                    />
                </div>
            </div>
        </div>
    );
};

export default StorageSavings;
