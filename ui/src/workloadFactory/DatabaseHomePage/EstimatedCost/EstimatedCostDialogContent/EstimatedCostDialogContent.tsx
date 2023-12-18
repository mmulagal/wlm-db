import { AccordionController, Typography, AccordionCard, AccordionCardContent, Button } from '@netapp/design-system';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import styles from './EstimatedCostDialogContent.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

const EstimatedCostDialogContent = () => {
    return (
        <div className={styles.estimatedCostDialog}>
            <Typography variant="Regular_14">{GENERAL.EC_HEADER} </Typography>
            <div className={styles.accordionSectionEC}>
                <AccordionController isGrouped>
                    <div className={styles.firstAccordion}>
                        <AccordionCard
                            id="1"
                            title={
                                <div>
                                    {GENERAL.STEP1} <span className={styles.titleMainContent}>{GENERAL.STEP1TEXT}</span>
                                </div>
                            }
                        >
                            <AccordionCardContent>
                                <Typography variant="Regular_14">
                                    <div className={styles.allContent}>
                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>1 |</div>
                                            <div className={styles.content}>{GENERAL.STEP1POINT1}</div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>2 |</div>
                                            <div className={styles.content}>
                                                <div>{GENERAL.STEP1POINT2}</div>
                                                <Button variant="link">{GENERAL.STEP1POINT2BUTTON}</Button>
                                            </div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>3 |</div>
                                            <div className={styles.content}>
                                                {GENERAL.STEP1POINT3}
                                                <div className={styles.bulletItems}>
                                                    <div className={styles.singleItem}>
                                                        <Bullet />
                                                        <Typography variant="Regular_14">
                                                            "ce:GetCostAndUsage",
                                                        </Typography>
                                                    </div>
                                                    <div className={styles.singleItem}>
                                                        <Bullet />
                                                        <Typography variant="Regular_14">
                                                            "ce:GetCostAndUsage",
                                                        </Typography>
                                                    </div>
                                                    <div className={styles.singleItem}>
                                                        <Bullet />
                                                        <Typography variant="Regular_14">
                                                            "ce:GetCostAndUsage",
                                                        </Typography>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Typography>
                            </AccordionCardContent>
                        </AccordionCard>
                    </div>

                    <div className={styles.secondAccordion}>
                        <AccordionCard
                            id="2"
                            title={
                                <div>
                                    {GENERAL.STEP2} <span className={styles.titleMainContent}>{GENERAL.STEP2TEXT}</span>
                                </div>
                            }
                        >
                            <AccordionCardContent>
                                <Typography variant="Regular_14">
                                    <div className={styles.allContent}>
                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>1 |</div>
                                            <div className={styles.content}>{GENERAL.STEP2POINT1}</div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>2 |</div>
                                            <div className={styles.content}>{GENERAL.STEP2POINT2}</div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>3 |</div>
                                            <div className={styles.content}>Select the "wlmdb-cost-resource" key.</div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>4 |</div>
                                            <div className={styles.content}>{GENERAL.STEP2POINT4}</div>
                                        </div>
                                    </div>
                                </Typography>
                            </AccordionCardContent>
                        </AccordionCard>
                    </div>
                </AccordionController>
            </div>

            <Typography variant="Regular_14" className={styles.bottomPart}>
                The changes take effect within 24-48 hours.
            </Typography>
        </div>
    );
};

export default EstimatedCostDialogContent;
