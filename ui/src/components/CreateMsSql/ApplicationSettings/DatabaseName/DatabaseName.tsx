import { useEffect, useRef, useState } from 'react';
import { AccordionCard, AccordionCardContent, TextField, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import styles from './DatabaseName.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import AccordionError from '../../../../common/AccordionError/AccordionError';
import { useDispatch } from 'react-redux';
import { setDBName } from '../../../../store/mssql/mssqlFormSlice';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';
import { useAppSelector } from '../../../../store/storeHooks';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { generateRandomDBName } from '../../../../utils/utilityFunctions';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const DatabaseName = () => {
    const dispatch = useDispatch();

    const selectedDBName = useAppSelector(state => state.mssqlForm.dbName);
    const isCreateHit = useAppSelector(state => state.msSqlAction?.isCreateHit);
    const isDBClusterNameFilled = useAppSelector(state => state.msSqlAction?.dbNameSelected);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    const [databaseName, setDatabaseName] = useState(selectedDBName ? selectedDBName : generateRandomDBName());

    const databasenameRef = useRef(null);

    useEffect(() => {
        setDatabaseName(selectedDBName);
    }, [selectedDBName]);

    useEffect(() => {
        if (isCreateHit && !isDBClusterNameFilled) {
            setTimeout(() => {
                //@ts-ignore
                databasenameRef?.current?.focus();
            }, 60);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!isDBClusterNameFilled, isCreateHit]);

    function isValidDBName() {
        if (isDemoMode) {
            return '';
        }
        const firstChar = databaseName.charAt(0);
        // Check if the instance name is 16 characters or less in length

        if (databaseName.length === 0) {
            return GENERAL.ACTION_REQUIRED;
        } else if (
            databaseName.length > 0 &&
            (databaseName.length > 15 || !/^[a-zA-Z0-9]/.test(firstChar) || !/^[a-zA-Z0-9/-]+$/.test(databaseName))
        ) {
            return GENERAL.DB_NAME_TOOLTIP;
        }
    }
    //Set the Header text here
    const setHeader = () => {
        if (!databaseName) {
            return <ActionRequired error={!isDBClusterNameFilled ? true : false} />;
        } else if (isValidDBName()) {
            return <AccordionError />;
        } else {
            return <Typography variant="Regular_14">{databaseName}</Typography>;
        }
    };

    return (
        <div className={styles['db-name']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="10"
                title={<div className={CommonStyles.title}>{GENERAL.DATABASE_NAME}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.content}>
                            <TextField
                                ref={databasenameRef}
                                info={
                                    <div className={styles.userNameTooltip}>
                                        <div className={styles.list}>
                                            <div className={styles.listItem}>
                                                <Bullet />
                                                <div className={styles.textWidth}>{GENERAL.DB_NAME_TOOLTIP1}</div>
                                            </div>
                                            <div className={styles.listItem}>
                                                <Bullet />
                                                <div className={styles.textWidth}>{GENERAL.DB_NAME_TOOLTIP2}</div>
                                            </div>
                                            <div className={styles.listItem}>
                                                <Bullet />
                                                <div className={styles.textWidth}>{GENERAL.DB_NAME_TOOLTIP3}</div>
                                            </div>
                                        </div>
                                    </div>
                                }
                                label={GENERAL.DATABASE_INSTANCE_NAME}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setDatabaseName(e.target.value);
                                    dispatch(setDBName(e.target.value));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                error={useDelayedError(isValidDBName())}
                                value={databaseName}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseName;
