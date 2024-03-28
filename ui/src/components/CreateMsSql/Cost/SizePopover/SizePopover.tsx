import { Typography } from '@netapp/design-system';
import styles from './SizePopover.module.scss';
import { formatFractionalNumber } from '../../../../utils/utilityFunctions';

const SizePopover = (data: any) => {
    return (
        <div className={styles.sizeContainer}>
            {/* <div className={styles.sizeContainerHeader}>
                <Typography variant="Semibold_13">{''}</Typography>
                <Typography variant="Regular_13">{'Size'}</Typography>
            </div> */}

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {'Data'}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {`${formatFractionalNumber(data?.data, 2)} GiB`}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {'Log'}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {`${formatFractionalNumber(data?.log, 2)} GiB`}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {'Tempdb'}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {`${formatFractionalNumber(data?.tempdb, 2)} GiB`}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {'Quorum'}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {`${formatFractionalNumber(data?.quorum, 2)} GiB`}
                </Typography>
            </div>

            <div className={styles.lastContainer}>
                <Typography variant="Semibold_13" className={styles.totalSize}>
                    {'Total'}
                </Typography>
                <Typography variant="Semibold_13" className={styles.totalSize}>
                    {`${formatFractionalNumber(data?.total, 2)} GiB`}
                </Typography>
            </div>
        </div>
    );
};

export default SizePopover;
