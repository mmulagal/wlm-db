import React from 'react';
import { ReactComponent as DatabaseIllustration } from '../../../assets/Database Illustration 2.svg';
import { ReactComponent as ComingSoon } from '../../../assets/comingSoon2.svg';
import styles from './DatabaseHost.module.scss';
import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

const DatabaseHost = () => {
    const hostData = useAppSelector(state => state.databaseHome.aggregatedHostsCount);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventory.getDatabaseHosts);

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
                        {databaseHostsLoading && <FlashingDotsLoader />}
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
                        {(databaseHostsLoading || fullHostDataLoading) && <FlashingDotsLoader />}
                    </div>
                </div>

                <div className={styles.newSection}>
                    <div className={styles.sql}>
                        <Typography variant="Regular_32" className={styles.databaseNumber}>
                            {hostData?.totalHosts}
                        </Typography>
                        <div className={styles.sqlContent}>
                            <Typography variant="Regular_14" className={styles.databaseText}>
                                {GENERAL.MICROSOFT_SQL}
                            </Typography>
                            {databaseHostsLoading && <FlashingDotsLoader />}
                        </div>
                    </div>

                    <div className={styles.dbHostSeparator} />

                    <div className={styles.NA}>
                        <Typography variant="Regular_16" className={styles.databaseNumber}>
                            N/A
                        </Typography>
                        <div className={styles.naContent}>
                            <Typography variant="Regular_14" className={styles.databaseText}>
                                PostgreSQL
                            </Typography>
                            <ComingSoon />
                        </div>
                    </div>

                    {/* <div className={styles.dbHostSeparator} />

                    <div className={styles.NA}>
                        <Typography variant="Regular_16" className={styles.databaseNumber}>
                            N/A
                        </Typography>
                        <div className={styles.naContent}>
                            <Typography variant="Regular_14" className={styles.databaseText}>
                                MySQL
                            </Typography>
                            <ComingSoon />
                        </div>
                    </div> */}
                </div>
            </div>
        </div>
    );
};

export default DatabaseHost;
