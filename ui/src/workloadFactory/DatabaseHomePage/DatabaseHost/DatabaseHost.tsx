import React from 'react';
import { ReactComponent as DatabaseIllustration } from '../../../assets/Database Illustration 2.svg';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import styles from './DatabaseHost.module.scss';
import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

const DatabaseHost = () => {
    const hostData = useAppSelector(state => state.databaseHome.aggregatedHostsCount);
    const { databaseHostsLoading } = useAppSelector(state => state.databaseHome.getDatabaseHosts);
    const { databaseJobsLoading } = useAppSelector(state => state.databaseHome.getDatabaseJobs);

    return (
        <div className={styles.databaseHost}>
            <div className={styles.leftContainer}>
                <DatabaseIllustration />
                <div className={styles.databaseHostsContainer}>
                    <Typography variant="Regular_32" className={styles.databaseNumber}>
                        {hostData?.totalHosts}
                    </Typography>
                    <div className={styles.databaseContent}>
                        <Typography variant="Regular_14" className={styles.databaseText}>
                            {GENERAL.HOSTS}
                        </Typography>
                        {(databaseHostsLoading || databaseJobsLoading) && 
                            <FlashingDotsLoader />
                        }
                    </div>
                </div>
                <div className={styles.dbHostSeparator} />
                <div className={styles.databaseHostsContainer}>
                    <Typography variant="Regular_32" className={styles.databaseNumber}>
                        {hostData?.totalDatabases}
                    </Typography>
                    <div className={styles.databaseContent}>
                        <Typography variant="Regular_14" className={styles.databaseText}>
                            {GENERAL.DATABASES}
                        </Typography>
                        {(databaseHostsLoading || databaseJobsLoading) && 
                            <FlashingDotsLoader />
                        }
                    </div>
                </div>

                <div className={styles.databaseHostStatusContainer}>
                    <Typography variant="Semibold_14" className={styles.dbHostStatusHeading}>
                        {GENERAL.DATABASE_HOST_STATUS}
                    </Typography>
                    <div className={styles.statusContainer}>
                        <div className={styles.layout}>
                            <div className={styles.firstRow}>
                                <Success />
                                <Typography variant="Semibold_14">{hostData?.totalUpHosts}</Typography>
                            </div>
                            <div className={styles.secondRowContent}>
                                <Typography variant="Regular_14" className={styles.secondRow}>
                                    {GENERAL.DB_HOST_UP}
                                </Typography>
                                {(databaseHostsLoading || databaseJobsLoading) && 
                                    <FlashingDotsLoader />
                                }
                            </div>
                        </div>
                        <div className={styles.layout}>
                            <div className={styles.firstRow}>
                                <InProgress />
                                <Typography variant="Semibold_14">{hostData?.totalInitializingHosts}</Typography>
                            </div>
                            <div className={styles.secondRowContent}>
                                <Typography variant="Regular_14" className={styles.secondRow}>
                                    {GENERAL.DB_HOST_INITIALIZING}
                                </Typography>
                                {(databaseHostsLoading || databaseJobsLoading) && 
                                    <FlashingDotsLoader />
                                }
                            </div>
                        </div>
                        <div className={styles.layout}>
                            <div className={styles.firstRow}>
                                <Warning />
                                <Typography variant="Semibold_14">{hostData?.totalDownHosts}</Typography>
                            </div>
                            <div className={styles.secondRowContent}>
                                <Typography variant="Regular_14" className={styles.secondRow}>
                                    {GENERAL.DB_HOST_DOWN}
                                </Typography>
                                {(databaseHostsLoading || databaseJobsLoading) && 
                                    <FlashingDotsLoader />
                                }
                            </div>
                        </div>
                        {/* <div className={styles.layout}>
                            <div className={styles.firstRow}>
                                <ErrorIcon />
                                <Typography variant="Semibold_14">{hostData?.totalFailedHosts}</Typography>
                            </div>
                            <div className={styles.secondRowContent}>
                                <Typography variant="Regular_14" className={styles.secondRow}>
                                    {GENERAL.DB_HOST_FAILED}
                                </Typography>
                                {(databaseHostsLoading || databaseJobsLoading) && 
                                    <FlashingDotsLoader />
                                }
                            </div>
                        </div> */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseHost;
