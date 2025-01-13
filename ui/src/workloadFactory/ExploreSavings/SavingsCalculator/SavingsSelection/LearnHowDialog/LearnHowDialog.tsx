import { AccordionCard, AccordionCardContent, AccordionController, DsTypography, Popover } from '@netapp/design-system';
import styles from './LearnHowDialog.module.scss';
import { GENERAL } from '../../../../../utils/appConstants';

import { ReactComponent as CopyIcon } from '../../../../../assets/ic_copy.svg';
import { useEffect, useState } from 'react';
import CopyToClipboardCommon from '../../../../../common/CopyToClipboard/copyToClipboard';

const LearnHowDialog = ({ type }: { type: string }) => {
    const [headerText, setHeaderText] = useState<string>('');

    useEffect(() => {
        if (type === 'tco') {
            setHeaderText(GENERAL.LEARN_HOW_DIALOG.HEADER_TEXT);
        } else if (type === 'assessment') {
            setHeaderText(GENERAL.LEARN_HOW_DIALOG.ASSESSMENT_HEADER_TEXT);
        }
    });

    return (
        <div className={styles.learnHowDialog}>
            <DsTypography variant="Regular_14">{headerText} </DsTypography>
            <div className={styles.accordionSectionEC}>
                <AccordionController isGrouped>
                    <div className={styles.firstAccordion}>
                        <AccordionCard
                            id="1"
                            title={
                                <div>
                                    {GENERAL.STEP1}{' '}
                                    <span className={styles.titleMainContent}>
                                        {GENERAL.LEARN_HOW_DIALOG.STEP1_HEADER}
                                    </span>
                                </div>
                            }
                        >
                            <AccordionCardContent>
                                <DsTypography variant="Regular_14">
                                    <div className={styles.allContent}>
                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>a &nbsp;|</div>
                                            <div className={styles.content}>
                                                {GENERAL.LEARN_HOW_DIALOG.STEP1_POINT1}
                                            </div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>b &nbsp;|</div>
                                            <div className={styles.content}>
                                                <div>{GENERAL.LEARN_HOW_DIALOG.STEP1_POINT2}</div>
                                                <div className={styles['dialog-body']}>
                                                    <div className={styles['code-box']}>
                                                        <div className={styles['code']}>
                                                            <pre>
                                                                <DsTypography variant="Regular_14">
                                                                    {JSON.stringify(
                                                                        GENERAL.LEARN_HOW_DIALOG.PERMISSIONS,
                                                                        null,
                                                                        1
                                                                    )}
                                                                </DsTypography>
                                                            </pre>
                                                        </div>
                                                        <div className={styles['copy']}>
                                                            <Popover
                                                                popoverClass={styles['copy-popover']}
                                                                children={'Permissions copied'}
                                                                container={
                                                                    <CopyToClipboardCommon
                                                                        value={JSON.stringify(
                                                                            GENERAL.LEARN_HOW_DIALOG.PERMISSIONS,
                                                                            null,
                                                                            1
                                                                        )}
                                                                        iconProvided={
                                                                            <CopyIcon fill={'#A7A7A7'}></CopyIcon>
                                                                        }
                                                                    />
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </DsTypography>
                            </AccordionCardContent>
                        </AccordionCard>
                    </div>

                    <div className={styles.secondAccordion}>
                        <AccordionCard
                            id="2"
                            title={
                                <div>
                                    {GENERAL.STEP2}{' '}
                                    <span className={styles.titleMainContent}>
                                        {GENERAL.LEARN_HOW_DIALOG.STEP2_HEADER}
                                    </span>
                                </div>
                            }
                        >
                            <AccordionCardContent>
                                <DsTypography variant="Regular_14">
                                    <div className={styles.allContent}>
                                        <div className={styles.listItems}>
                                            <div className={styles.content}>{GENERAL.LEARN_HOW_DIALOG.STEP2_TITLE}</div>
                                        </div>
                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>a &nbsp;|</div>
                                            <div className={styles.content}>
                                                {GENERAL.LEARN_HOW_DIALOG.STEP2_POINT1}
                                                <a
                                                    href={GENERAL.LEARN_HOW_DIALOG.STEP2_POINT1_LINK}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {GENERAL.LEARN_HOW_DIALOG.STEP2_POINT1_LINK}
                                                </a>
                                            </div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>b &nbsp;|</div>
                                            <div className={styles.content}>
                                                {GENERAL.LEARN_HOW_DIALOG.STEP2_POINT2}
                                            </div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>c &nbsp;|</div>
                                            <div className={styles.content}>
                                                {GENERAL.LEARN_HOW_DIALOG.STEP2_POINT3}
                                            </div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>d &nbsp;|</div>
                                            <div className={styles.content}>
                                                {GENERAL.LEARN_HOW_DIALOG.STEP2_POINT4}
                                            </div>
                                        </div>

                                        <div className={styles.listItems}>
                                            <div className={styles.numberDigit}>e &nbsp;|</div>
                                            <div className={styles.content}>
                                                {GENERAL.LEARN_HOW_DIALOG.STEP2_POINT5}
                                            </div>
                                        </div>
                                    </div>
                                </DsTypography>
                            </AccordionCardContent>
                        </AccordionCard>
                    </div>
                </AccordionController>
            </div>

            <DsTypography variant="Regular_14" className={styles.bottomPart}>
                {GENERAL.LEARN_HOW_DIALOG.FOOTER_TEXT}
            </DsTypography>
        </div>
    );
};

export default LearnHowDialog;
