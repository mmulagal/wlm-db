import { useEffect } from 'react';
import { AccordionCard, AccordionCardContent, TextField, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import styles from './DatabaseName.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import AccordionError from '../../../../common/AccordionError/AccordionError';
import { useDispatch } from 'react-redux';
import { setDBName } from '../../../../store/mssql/mssqlFormSlice';
import { SQL_DATABASE } from '../../../../utils/consts';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';
import { useAppSelector } from '../../../../store/storeHooks';

const DatabaseName = () => {
    const dispatch = useDispatch();

    const selectedDBName = useAppSelector(state => state.mssqlForm.dbName);

    useEffect(() => {
        if(!selectedDBName){
            dispatch(setDBName(SQL_DATABASE));
        }
    });

    function isValidDBName() {
        const firstChar = selectedDBName.charAt(0);
        // Check if the instance name is 16 characters or less in length

        if (
            selectedDBName.length > 0 &&
            (selectedDBName.length > 15 || !/^[a-zA-Z0-9]/.test(firstChar) || !/^[a-zA-Z0-9/-]+$/.test(selectedDBName))
        ) {
            return GENERAL.DB_NAME_TOOLTIP;
        }
    }
    //Set the Header text here
    const setHeader = () => {
        if (isValidDBName()) {
            return <AccordionError />;
        } else {
            return <Typography variant="Regular_14">{selectedDBName}</Typography>;
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
                                    dispatch(setDBName(e.target.value));
                                }}
                                error={useDelayedError(isValidDBName())}
                                value={selectedDBName}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseName;
