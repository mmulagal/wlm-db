import React from 'react';
import { ReactComponent as DatabaseIllustration } from '../../../assets/Database Illustration 2.svg';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import styles from './DatabaseHost.module.scss';
import { Typography } from '@netapp/design-system';

const DatabaseHost = () => {
    return (
        <div className={styles.databaseHost}>
            <div className={styles.leftContainer}>
                <DatabaseIllustration />
                <div className={styles.databaseHostsContainer}>
                    <Typography variant="Regular_32" className={styles.databaseNumber}>
                        24
                    </Typography>
                    <Typography variant="Regular_14" className={styles.databaseText}>
                        Database hosts
                    </Typography>
                </div>
                <div className={styles.dbHostSeparator} />
                <div className={styles.databaseHostStatusContainer}>
                    <Typography variant="Semibold_14" className={styles.dbHostStatusHeading}>
                        Database host status
                    </Typography>
                    <div className={styles.statusContainer}>
                        <div className={styles.layout}>
                            <div className={styles.firstRow}>
                                <Success />
                                <Typography variant="Semibold_14">22</Typography>
                            </div>
                            <Typography variant="Regular_14" className={styles.secondRow}>
                                Up
                            </Typography>
                        </div>
                        <div className={styles.layout}>
                            <div className={styles.firstRow}>
                                <InProgress />
                                <Typography variant="Semibold_14">2</Typography>
                            </div>
                            <Typography variant="Regular_14" className={styles.secondRow}>
                                Initializing
                            </Typography>
                        </div>
                        <div className={styles.layout}>
                            <div className={styles.firstRow}>
                                <Warning />
                                <Typography variant="Semibold_14">0</Typography>
                            </div>
                            <Typography variant="Regular_14" className={styles.secondRow}>
                                Down
                            </Typography>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseHost;
