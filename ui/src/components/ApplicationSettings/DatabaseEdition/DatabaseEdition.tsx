import { useState } from 'react';
import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './DatabaseEdition.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const DatabaseEdition = () => {
    const [dbEdition, setDbEdition] = useState(GENERAL.SQL_SERVER_STANDARD_EDITION);
    //Set the Header text here
    const setHeader = () => {
        return ['Windows server 2016'];
    };
    return (
        <div className={styles['db-edition']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="7"
                title={<div className={CommonStyles.title}>{GENERAL.DATABASE_EDITION}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.genericStyle}>
                            <RadioButton
                                isChecked={dbEdition === GENERAL.SQL_SERVER_STANDARD_EDITION}
                                onChange={() => {
                                    setDbEdition(GENERAL.SQL_SERVER_STANDARD_EDITION);
                                }}
                                children={GENERAL.SQL_SERVER_STANDARD_EDITION}
                                className={styles.radio}
                            />
                            <Typography variant="Regular_14" className={styles.textEdition}>
                                {GENERAL.SQL_SERVER_STANDARD_EDITION_TEXT}
                            </Typography>
                        </div>
                        <div className={styles.genericStyle}>
                            <RadioButton
                                isChecked={dbEdition === GENERAL.SQL_SERVER_WEB_EDITION}
                                onChange={() => {
                                    setDbEdition(GENERAL.SQL_SERVER_WEB_EDITION);
                                }}
                                children={GENERAL.SQL_SERVER_WEB_EDITION}
                                className={styles.radio}
                            />
                            <Typography variant="Regular_14" className={styles.textEdition}>
                                {GENERAL.SQL_SERVER_WEB_EDITION_TEXT}
                            </Typography>
                        </div>
                        <div className={styles.genericStyle}>
                            <RadioButton
                                isChecked={dbEdition === GENERAL.SQL_SERVER_ENTERPRiSE_EDITION}
                                onChange={() => {
                                    setDbEdition(GENERAL.SQL_SERVER_ENTERPRiSE_EDITION);
                                }}
                                children={GENERAL.SQL_SERVER_ENTERPRiSE_EDITION}
                                className={styles.radio}
                            />
                            <Typography variant="Regular_14" className={styles.textEdition}>
                                {GENERAL.SQL_SERVER_ENTERPRiSE_EDITION_TEXT}
                            </Typography>
                            <div className={styles.separator} />
                            <div className={styles.AddSpace} />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseEdition;
