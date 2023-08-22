import { Typography } from '@netapp/design-system';
import { ReactComponent as DatabasesIcon } from '../../../../assets/databases-icon.svg';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './DatabasesSummary.module.scss';

type DatabasesSummaryProps = {
    summaryData: {
        count: number | string;
        sizeValue: number | string;
        sizeUnit: string;
    };
};

const DatabaseSummary = ({ summaryData }: DatabasesSummaryProps) => {
    return (
        <div className={styles.databaseSummary}>
            <div className={styles.card}>
                <Typography className={styles.summaryTitle} variant="Semibold_14">
                    {GENERAL.DATABASES_SUMMARY}
                </Typography>
            </div>
            <div className={styles.card}>
                <div className={styles.iconContainer}>
                    <DatabasesIcon />
                </div>
                <div className={styles.dataToShow}>
                    <Typography className={styles.dataValue} variant="Regular_32">
                        {summaryData.count}
                    </Typography>
                    <Typography className={styles.dataLabel} variant="Regular_14">
                        {GENERAL.DATABASES}
                    </Typography>
                </div>
            </div>
            <div className={`${styles.card} ${styles.lastCard}`}>
                <div className={styles.memoryData}>
                    <Typography className={styles.memoryValue} variant="Regular_32">
                        {summaryData.sizeValue}
                    </Typography>
                    <Typography className={styles.memoryUnit} variant="Regular_16">
                        {summaryData.sizeUnit}
                    </Typography>
                </div>
                <Typography className={styles.dataLabel} variant="Regular_14">
                    {GENERAL.TOTAL_SIZE}
                </Typography>
            </div>
        </div>
    );
};

export default DatabaseSummary;
