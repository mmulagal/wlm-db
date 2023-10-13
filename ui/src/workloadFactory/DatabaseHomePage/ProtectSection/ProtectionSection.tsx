import React from 'react';
import styles from './ProtectionSection.module.scss';
import { Typography } from '@netapp/design-system';
import MultiRingDoughnut from '../MultiRingDoughnut/MultiRingDoughnut';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { formatFractionalNumber } from '../../../utils/utilityFunctions';

const ProtectionSection = () => {
    const hostData = useAppSelector(state => state.databaseHome.aggregatedProtectionDbCount);

    return (
        <div className={styles.protectionSection}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16">{GENERAL.DB_HOST_PROTECTION}</Typography>
            </div>

            <div className={styles.secondContainer}>
                <MultiRingDoughnut />

                <div className={styles.secondLevel}>
                    <Typography variant="Semibold_14">{GENERAL.DATABASE_PROTECTION}</Typography>
                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                            <Typography variant="Regular_14">{GENERAL.DB_HOST_PROTECTED}</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">
                                {formatFractionalNumber(hostData?.protectedPercent)} %
                            </Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">{hostData?.protectedDb} Databases</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-6)' }} />
                            <Typography variant="Regular_14">{GENERAL.DB_HOST_UNPROTECTED}</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">
                                {formatFractionalNumber(hostData?.unprotectedPercent)} %
                            </Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">{hostData?.unprotectedDb} Databases</Typography>
                        </div>
                    </div>
                    <div className={styles.separatorProtection} />
                </div>

                {/* 3rd Row */}
                <div className={styles.secondLevel}>
                    <Typography variant="Semibold_14">{GENERAL.PROTECTED_DB_DISTRIBUTION}</Typography>
                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-1)' }} />
                            <Typography variant="Regular_14">{GENERAL.AWS_BACKUP}</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">
                                {formatFractionalNumber(hostData?.awsBackupPercent)} %
                            </Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">{hostData?.awsBackupDb} Databases</Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-9)' }} />
                            <Typography variant="Regular_14">{GENERAL.FSX_ONTAP_SNAPSHOTS}</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">
                                {formatFractionalNumber(hostData?.fsxOntapSnapshotsPercent)} %
                            </Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">{hostData?.fsxOntapSnapshotsDb} Databases</Typography>
                        </div>
                    </div>
                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <div className={styles.square} style={{ backgroundColor: 'var(--chart-3)' }} />
                            <Typography variant="Regular_14">{GENERAL.SQL_SERVER_BACKUP}</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">
                                {formatFractionalNumber(hostData?.sqlServerBackupPercent)} %
                            </Typography>
                            <div className={styles.separatorSecondPart} />
                            <Typography variant="Regular_14">{hostData?.sqlServerBackupDb} Databases</Typography>
                        </div>
                    </div>
                    <div className={styles.separatorProtection} />
                </div>
            </div>
        </div>
    );
};

export default ProtectionSection;
