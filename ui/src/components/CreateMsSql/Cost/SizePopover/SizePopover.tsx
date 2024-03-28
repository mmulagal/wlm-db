import { Typography } from '@netapp/design-system';
import styles from './SizePopover.module.scss';
import { formatFractionalNumber } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';

const SizePopover = (data: any) => {
    return (
        <div className={styles.sizeContainer}>
            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {GENERAL.DATA_SIZE}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {`${formatFractionalNumber(data?.data, 2)} GiB`}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {GENERAL.LOG_SIZE}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {`${formatFractionalNumber(data?.log, 2)} GiB`}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {GENERAL.TEMPDB_SIZE}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {`${formatFractionalNumber(data?.tempdb, 2)} GiB`}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {GENERAL.QUORUM_SIZE}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {`${formatFractionalNumber(data?.quorum, 2)} GiB`}
                </Typography>
            </div>

            <div className={styles.lastContainer}>
                <Typography variant="Semibold_13" className={styles.totalSize}>
                    {GENERAL.TOTAL_SIZE}
                </Typography>
                <Typography variant="Semibold_13" className={styles.totalSize}>
                    {`${formatFractionalNumber(data?.total, 2)} GiB`}
                </Typography>
            </div>
        </div>
    );
};

export default SizePopover;
