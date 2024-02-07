import { PasswordField, TextField, Typography } from '@netapp/design-system';
import styles from './UndetectedSecondDialog.module.scss';

const UndetectedSecondDialog = () => {
    return (
        <div className={styles.secondDialog}>
            <Typography variant="Semibold_14">Detected host information</Typography>

            <div className={styles.contentSection}>
                <div className={styles.leftSide}>
                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '116px' }}>
                            Host name
                        </Typography>
                        <Typography variant="Semibold_14">Host name number 1</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '116px' }}>
                            Host type
                        </Typography>
                        <Typography variant="Semibold_14">FSx for ONTAP</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '48px' }}>
                        <Typography variant="Regular_14" style={{ width: '148px' }}>
                            Number of databases
                        </Typography>
                        <Typography variant="Semibold_14">10</Typography>
                    </div>

                    <div className={styles.separator} />
                </div>

                <div className={styles.rightSide}>
                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            SQL version
                        </Typography>
                        <Typography variant="Semibold_14">2022</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            Deployment model
                        </Typography>
                        <Typography variant="Semibold_14">Stand alone</Typography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.entry} style={{ gap: '80px' }}>
                        <Typography variant="Regular_14" style={{ width: '124px' }}>
                            Edition
                        </Typography>
                        <Typography variant="Semibold_14">Enterprise</Typography>
                    </div>

                    <div className={styles.separator} />
                </div>
            </div>
        </div>
    );
};

export default UndetectedSecondDialog;
