import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { ReactComponent as TablesIcon } from '../../../../assets/tables-icon.svg';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './TablesSummary.module.scss';

type TablesSummaryProps = {
    summaryData: {
        count: number | string;
        sizeValue: number | string;
        sizeUnit: string;
        isLoading: boolean;
    };
};

const TablesSummary = ({ summaryData }: TablesSummaryProps) => (
    <div className={styles.databaseSummary}>
        <div className={styles.card}>
            <Typography className={styles.summaryTitle} variant="Semibold_14">
                {GENERAL.TABLES_SUMMARY}
            </Typography>
        </div>
        <div className={styles.card}>
            <div className={styles.iconContainer}>
                <TablesIcon />
            </div>
            <div className={styles.dataToShow}>
                {summaryData.isLoading ? (
                    <div className={styles.loaderContainer}>
                        <FlashingDotsLoader />
                    </div>
                ) : (
                    <Typography className={styles.dataValue} variant="Regular_32">
                        {summaryData.count}
                    </Typography>
                )}
                <Typography className={styles.dataLabel} variant="Regular_14">
                    {GENERAL.TABLES}
                </Typography>
            </div>
        </div>
        <div className={`${styles.card} ${styles.lastCard}`}>
            <div className={styles.memoryData}>
                {summaryData.isLoading ? (
                    <div className={styles.loaderContainer}>
                        <FlashingDotsLoader />
                    </div>
                ) : (
                    <Typography className={styles.memoryValue} variant="Regular_32">
                        {summaryData.sizeValue}
                    </Typography>
                )}
                {!summaryData.isLoading && (
                    <Typography className={styles.memoryUnit} variant="Regular_16">
                        {summaryData.sizeUnit}
                    </Typography>
                )}
            </div>
            <Typography className={styles.dataLabel} variant="Regular_14">
                {GENERAL.TOTAL_SIZE}
            </Typography>
        </div>
    </div>
);

export default TablesSummary;
