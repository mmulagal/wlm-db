import { Typography } from "@netapp/design-system";
import { GENERAL } from "../../../utils/appConstants";
import styles from './DatabaseTable.module.scss';

const DatabaseEstimatedCost = (data: any) => {
    return (
        <div className={styles.costContainer}>
            <div className={styles.costContainerHeader}>
                <Typography variant="Semibold_13">
                                {GENERAL.RESOURCES}
                </Typography>
                <Typography variant="Regular_13">
                                {GENERAL.AMOUNT_IN_USD}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {GENERAL.COMPUTE}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {data?.compute}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {GENERAL.STORAGE}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {data?.storage}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {GENERAL.CONNECTIVITY}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {data?.connectivity}
                </Typography>
            </div>

            <div className={styles.middleContainer}>
                <Typography variant="Semibold_13" className={styles.middle}>
                    {GENERAL.OTHER}
                </Typography>
                <Typography variant="Regular_13" className={styles.middle}>
                    {data?.others}
                </Typography>
            </div>

            <div className={styles.lastContainer}>
                <Typography variant="Semibold_13" className={styles.totalCost}>
                    {GENERAL.ESTIMATED_MONTHLY_COST}
                </Typography>
                <Typography variant="Semibold_13" className={styles.totalCost}>
                    {data?.totalCost}
                </Typography>
            </div>
        </div>
    )
}

export default DatabaseEstimatedCost;
