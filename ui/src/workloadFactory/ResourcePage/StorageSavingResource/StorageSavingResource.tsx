import React from 'react';
import styles from './StorageSavingResource.module.scss';
import { DsTypography, FlashingDotsLoader, TooltipInfo, Typography } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { formatFractionalNumber, formatSize } from '../../../utils/utilityFunctions';
import { ReactComponent as Bullet } from '../../../assets/ic_bullet.svg';
import { ReactComponent as Savings } from '../../../assets/Savings.svg';

type StorageSavingsProps = {
    hostData: any;
    hostsLoading?: boolean;
};

const StorageSavingResource = ({ hostData, hostsLoading }: StorageSavingsProps) => {
    const handleProgressBar = () => {
        if (
            hostData?.storageSavingsPercent !== 0 &&
            //@ts-ignore
            hostData?.storageSavingsPercent <= 1
        ) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-9)'
                        }}
                    ></div>
                </div>
            );
        }
        if (
            hostData?.storageSavingsPercent !== 0 &&
            //@ts-ignore
            hostData?.storageSavingsPercent >= 1
        ) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar}`}
                        style={{
                            width: `${hostData?.storageSavingsPercent}%`,
                            backgroundColor: 'var(--chart-4)'
                        }}
                    ></div>
                    <div className={styles.separator}></div>
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100 - (hostData?.storageSavingsPercent || 0)}%`,
                            backgroundColor: 'var(--chart-9)'
                        }}
                    ></div>
                </div>
            );
        }

        if (hostData?.storageSavingsPercent === 0) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    ></div>
                </div>
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

                {hostsLoading && <FlashingDotsLoader />}
            </div>

            <div className={styles.largeContainer}>
                <div className={styles.firstSegment} style={{ paddingRight: '0', width: '334px' }}>
                    <div className={styles.leftSection}>
                        <Savings />
                    </div>
                    <div className={styles.rightSection}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {hostsLoading && (
                                <div className={styles.loadingContainer}>
                                    <FlashingDotsLoader />
                                </div>
                            )}
                            {!hostsLoading && <>{formatFractionalNumber(hostData?.storageSavingsPercent, 2)}%</>}
                        </DsTypography>

                        <DsTypography variant="Regular_14" className={''}>
                            {GENERAL.SANDBOX_STORAGE_SAVINGS}
                        </DsTypography>
                    </div>
                </div>

                <div className={styles.secondSegment}>
                    {handleProgressBar()}

                    <div className={styles.secondRow}>
                        <div className={styles.bottomRow}>
                            <div className={styles.square} style={{ backgroundColor: '#68C6B3' }} />

                            <DsTypography variant="Semibold_14" style={{ lineHeight: 'unset' }}>
                                {formatSize(hostData?.storageSavings)}
                            </DsTypography>

                            <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                {GENERAL.SANDBOX_STORAGE_SAVINGS}
                            </DsTypography>
                        </div>

                        <div className={styles.bottomRow}>
                            <div className={styles.square} style={{ backgroundColor: '#A815F3' }} />

                            <DsTypography variant="Semibold_14" style={{ lineHeight: 'unset' }}>
                                {formatSize(hostData?.storageConsumes)}
                            </DsTypography>

                            <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                {GENERAL.SANDBOX_CONSUMED_STORAGE}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StorageSavingResource;
