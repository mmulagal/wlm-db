import { AccordionController, Typography, AccordionCard, AccordionCardContent } from '@netapp/design-system';
import { Popover } from '@netapp/design-system/dist/components/Popover';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import styles from './EstimatedCostDialogContent.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { COST_PERMISSION } from '../../../../utils/permissions';

const EstimatedCostDialogContent = () => {
    const data = JSON.stringify(COST_PERMISSION, null, 1);
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
                                            <div className={styles.numberDigit}>a &nbsp;|</div>
                                            <div className={styles.content}>{GENERAL.STEP1POINT1}</div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>b &nbsp;|</div>
                                            <div className={styles.content}>
                                                <div>{GENERAL.STEP1POINT2}</div>
                                                <div className={styles['dialog-body']}>
                                                    <div className={styles['code-box']}>
                                                        <div className={styles['code']}>
                                                            <pre>
                                                                <Typography variant="Regular_14">{data}</Typography>
                                                            </pre>
                                                        </div>
                                                        <div className={styles['copy']}>
                                                            <Popover
                                                                popoverClass={styles['copy-popover']}
                                                                children={'Permissions copied'}
                                                                container={
                                                                    <CopyToClipboard text={data}>
                                                                        <CopyIcon fill={'#A7A7A7'}></CopyIcon>
                                                                    </CopyToClipboard>
                                                                }
                                                            />
                                                        </div>
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
                                            <div className={styles.numberDigit}>a &nbsp;|</div>
                                            <div className={styles.content}>{GENERAL.STEP2POINT1}</div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>b &nbsp;|</div>
                                            <div className={styles.content}>
                                                {GENERAL.STEP2POINT2}{' '}
                                                <span style={{ fontWeight: '590' }}>{GENERAL.STEP2POINT2CONTINUE}</span>
                                            </div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>c &nbsp;|</div>
                                            <div className={styles.content}>Select the "wlmdb-cost-resource" key.</div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>d &nbsp;|</div>
                                            <div className={styles.content}>
                                                {GENERAL.STEP2POINT4}{' '}
                                                <span style={{ fontWeight: '590' }}>{GENERAL.STEP2POINT4ACTIVATE}</span>
                                            </div>
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
