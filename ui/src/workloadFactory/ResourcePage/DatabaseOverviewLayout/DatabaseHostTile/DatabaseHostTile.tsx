import { Typography } from '@netapp/design-system';
import { ReactComponent as DescriptionIcon } from '../../../../assets/Description Icons.svg';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import styles from './DatabaseHostTile.module.scss';

const DatabaseHostTile = () => {
    return (
        <div className={styles.dbHostTile}>
            <div className={styles.dbHostSection}>
                <DescriptionIcon />
                <div className={styles.secondLevel}>
                    <Typography variant="Semibold_14">Database host name</Typography>
                    <Typography variant="Regular_14">Host name</Typography>
                </div>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.statusSection}>
                <div className={styles.firstSection}>
                    <Success />
                    <Typography variant="Semibold_14">Up</Typography>
                </div>
                <Typography variant="Regular_14">Status</Typography>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.commonSection}>
                <Typography variant="Semibold_14">10</Typography>

                <Typography variant="Regular_14">Number of databases</Typography>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.commonSection}>
                <Typography variant="Semibold_14">150 TiB</Typography>

                <Typography variant="Regular_14">Total used capacity</Typography>
            </div>

            <div className={styles.dbHostSeparator} />

            <div className={styles.commonSection}>
                <Typography variant="Semibold_14">200 TiB</Typography>

                <Typography variant="Regular_14">Total allocated capacity</Typography>
            </div>
        </div>
    );
};

export default DatabaseHostTile;
