import { Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './EstimatedCostPopover.module.scss';
import { formatFractionalNumberForCost } from '../../../utils/utilityFunctions';

const EstimatedCostPopover = (data: any) => (
    <div className={styles.estimatedCostContainer}>
        <div className={styles.costContainerHeader}>
            <Typography variant="Semibold_13">{GENERAL.RESOURCES}</Typography>
            <Typography variant="Regular_13">{GENERAL.AMOUNT_IN_USD}</Typography>
        </div>

        <div className={styles.middleContainer}>
            <Typography variant="Semibold_13" className={styles.middle}>
                {GENERAL.COMPUTE}
            </Typography>
            <Typography variant="Regular_13" className={styles.middle}>
                {`$${formatFractionalNumberForCost(data?.compute, 2)}`}
            </Typography>
        </div>

        <div className={styles.middleContainer}>
            <Typography variant="Semibold_13" className={styles.middle}>
                {GENERAL.STORAGE}
            </Typography>
            <Typography variant="Regular_13" className={styles.middle}>
                {`$${formatFractionalNumberForCost(
                    (data?.storage?.fsxn || 0) + (data?.storage?.fsxw || 0) + (data?.storage?.ebs || 0),
                    2
                )}`}
            </Typography>
        </div>

        <div className={styles.middleContainer}>
            <Typography variant="Semibold_13" className={styles.middle}>
                {GENERAL.CONNECTIVITY}
            </Typography>
            <Typography variant="Regular_13" className={styles.middle}>
                {`$${formatFractionalNumberForCost(data?.connectivity, 2)}`}
            </Typography>
        </div>

        <div className={styles.middleContainer}>
            <Typography variant="Semibold_13" className={styles.middle}>
                {GENERAL.OTHER}
            </Typography>
            <Typography variant="Regular_13" className={styles.middle}>
                {`$${formatFractionalNumberForCost(data?.others, 2)}`}
            </Typography>
        </div>

        <div className={styles.lastContainer}>
            <Typography variant="Semibold_13" className={styles.totalCost}>
                {GENERAL.ESTIMATED_MONTHLY_COST}
            </Typography>
            <Typography variant="Semibold_13" className={styles.totalCost}>
                {`$${formatFractionalNumberForCost(data?.totalCost, 2)}`}
            </Typography>
        </div>
    </div>
);

export default EstimatedCostPopover;
