import React from 'react';
import styles from './ProtectionSection.module.scss';
import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import MultiRingDoughnut from '../MultiRingDoughnut/MultiRingDoughnut';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

const ProtectionSection = () => {
    const hostData = useAppSelector(state => state.databaseHome.aggregatedProtectionDbCount);

    const { databaseHostsLoading } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { databaseJobsLoading } = useAppSelector(state => state.databaseHome.getDatabaseJobs);

    return (
        <div className={styles.protectionSection}>
            <div className={styles.headSection}>
                <Typography variant="Regular_16" className={styles.title}>
                    {GENERAL.DB_HOST_PROTECTION}
                </Typography>

                {(databaseHostsLoading || databaseJobsLoading) && <FlashingDotsLoader />}
            </div>

            <div className={styles.secondContainer}>
                <MultiRingDoughnut
                    hostData={hostData}
                />

                <div className={styles.secondLevel}>
                    <div className={styles.headerPart}>
                        <div className={styles.square} style={{ backgroundColor: 'var(--chart-4)' }} />
                        <Typography variant="Semibold_14">{GENERAL.DATABASE_PROTECTION}</Typography>
                    </div>

                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <Typography variant="Regular_14">{GENERAL.AWS_BACKUP}</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">
                                {hostData?.awsBackupDb} {GENERAL.PROTECTION_DATABASES}
                            </Typography>
                        </div>
                    </div>

                    <div className={styles.separatorProtection} />

                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <Typography variant="Regular_14">{GENERAL.FSX_ONTAP_SNAPSHOTS}</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">
                                {hostData?.fsxOntapSnapshotsDb} {GENERAL.PROTECTION_DATABASES}
                            </Typography>
                        </div>
                    </div>
                    <div className={styles.separatorProtection} />
                    <div className={styles.row}>
                        <div className={styles.firstPart}>
                            <Typography variant="Regular_14">{GENERAL.SQL_SERVER_BACKUP}</Typography>
                        </div>

                        <div className={styles.secondPart}>
                            <Typography variant="Semibold_14">
                                {hostData?.sqlServerBackupDb} {GENERAL.PROTECTION_DATABASES}
                            </Typography>
                        </div>
                    </div>
                    <div className={styles.separatorProtection} />

                    {/* End here */}
                </div>

                {/* 3rd Row */}
            </div>
        </div>
    );
};

export default ProtectionSection;
