import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import styles from './DatabaseEdition.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedDBEdition } from '../../../store/mssql/mssqlFormSlice';

const DatabaseEdition = () => {
    const dbEdition = useSelector((state: any) => state.mssqlForm.dbEdition);

    const dispatch = useDispatch();
    //Set the Header text here
    const setHeader = () => {
        return <Typography variant="Regular_14">{dbEdition}</Typography>;
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
                                    dispatch(setSelectedDBEdition(GENERAL.SQL_SERVER_STANDARD_EDITION));
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
                                    dispatch(setSelectedDBEdition(GENERAL.SQL_SERVER_WEB_EDITION));
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
                                    dispatch(setSelectedDBEdition(GENERAL.SQL_SERVER_ENTERPRiSE_EDITION));
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
