import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './DatabaseEdition.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { setSelectedDBEdition } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const DatabaseEdition = () => {
    // To get selected DB edition
    const dbEdition = useAppSelector(state => state.mssqlForm.dbEdition);

    const dispatch = useDispatch();
    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{dbEdition?.label}</Typography>;
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
                                isChecked={dbEdition?.label === GENERAL.SQL_SERVER_STANDARD_EDITION}
                                onChange={() => {
                                    dispatch(
                                        setSelectedDBEdition({
                                            label: GENERAL.SQL_SERVER_STANDARD_EDITION,
                                            value: GENERAL.SQL_SERVER_STANDARD
                                        })
                                    );
                                    dispatch(setIsWizardTouched(true));
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
                                isChecked={dbEdition?.label === GENERAL.SQL_SERVER_ENTERPRiSE_EDITION}
                                onChange={() => {
                                    dispatch(
                                        setSelectedDBEdition({
                                            label: GENERAL.SQL_SERVER_ENTERPRiSE_EDITION,
                                            value: GENERAL.SQL_SERVER_ENTERPRISE
                                        })
                                    );
                                    dispatch(setIsWizardTouched(true));
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
