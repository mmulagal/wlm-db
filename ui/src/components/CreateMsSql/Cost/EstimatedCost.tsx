import { AccordionCard, AccordionCardContent, Typography } from '@netapp/design-system';
import { ReactComponent as ActionRequiredIcon } from '../../../assets/action-required.svg';
import styles from './EstimatedCost.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';

const EstimatedCost = () => {
    const setHeader = () => {
        return <Typography variant="Regular_14">cost</Typography>;
    };
    return (
        <div className={styles['estimated-cost']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="22"
                title={<div className={CommonStyles.title}>{GENERAL.ESTIMATED_COST}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14">{GENERAL.ESTIMATED_SUBTEXT}</Typography>
                    </Typography>
                    {/* Inside container */}
                    <div className={styles.ecContainer}>
                        <div className={styles.ecContainerHeader}>
                            <Typography variant="Semibold_14" className={styles.resource}>
                                {GENERAL.RESOURCES}
                            </Typography>
                            <Typography variant="Semibold_14" className={styles.amount}>
                                {GENERAL.AMOUNT_IN_USD}
                            </Typography>
                        </div>

                        <div className={styles.computeContainer}>
                            <Typography variant="Semibold_14" className={styles.compute}>
                                {GENERAL.COMPUTE}
                            </Typography>
                            <div className={styles.secondRow}>
                                <Typography variant="Regular_14">{GENERAL.INSTANCE_TYPE}: c4.2xlarge</Typography>
                                <Typography variant="Regular_14">{GENERAL.QUANTITY}: 2</Typography>
                            </div>
                            <div className={styles.thirdRow}>
                                <Typography variant="Regular_14" className={styles.costValue}>
                                    $ 4,347.36
                                </Typography>
                            </div>
                        </div>

                        <div className={styles.storageContainer}>
                            <Typography variant="Semibold_14" className={styles.compute}>
                                {GENERAL.STORAGE}
                            </Typography>
                            <div className={styles.secondRow}>
                                <Typography variant="Regular_14">{GENERAL.TYPE}: FSx for NetApp ONTAP</Typography>
                                <Typography variant="Regular_14">{GENERAL.SIZE}: 1024 GB</Typography>
                                <Typography variant="Regular_14">{GENERAL.THROUGHPUT}</Typography>
                            </div>
                            <div className={styles.thirdRow}>
                                <Typography variant="Regular_14" className={styles.costValue}>
                                    $ 500
                                </Typography>

                                <Typography
                                    variant="Regular_14"
                                    style={{ marginTop: '28px' }}
                                    className={styles.costValue}
                                >
                                    $ 154
                                </Typography>
                            </div>
                        </div>

                        <div className={styles.connectivityContainer}>
                            <Typography variant="Semibold_14" className={styles.compute}>
                                {GENERAL.CONNECTIVITY}
                            </Typography>
                            <div className={styles.secondRow}>
                                <Typography variant="Regular_14">New VPC</Typography>
                            </div>
                            <div className={styles.thirdRow}>
                                <Typography variant="Regular_14" className={styles.costValue}>
                                    $ 7.2
                                </Typography>
                            </div>
                        </div>

                        <div className={styles.adContainer}>
                            <Typography variant="Semibold_14" className={styles.compute}>
                                {GENERAL.ACTIVE_DIRECTORY}
                            </Typography>
                            <div className={styles.secondRow}>
                                <Typography variant="Regular_14">New Active Directory</Typography>
                            </div>
                            <div className={styles.thirdRow}>
                                <Typography variant="Regular_14" className={styles.costValue}>
                                    $ 288
                                </Typography>
                            </div>
                        </div>

                        <div className={styles.lastContainer}>
                            <Typography variant="Semibold_14" className={styles.ecCost}>
                                {GENERAL.ESTIMATED_MONTHLY_COST}
                            </Typography>
                            <Typography variant="Semibold_14" className={styles.ecCostValue}>
                                $ 5,296.56
                            </Typography>
                        </div>

                        <div className={styles.note}>
                            <ActionRequiredIcon />
                            <Typography variant="Regular_14">{GENERAL.EC_NOTE}</Typography>
                        </div>
                    </div>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default EstimatedCost;
