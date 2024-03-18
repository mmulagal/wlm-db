import {
    AccordionCard,
    AccordionCardContent,
    DsTypography,
    TextField,
    useAccordionContext
} from '@netapp/design-system';

import styles from './DatabaseName.module.scss';
import CommonStyles from '../../../../../utils/CommonStyles.module.scss';
import ActionRequired from '../../../../../common/ActionRequired/ActionRequired';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setNewUserDBName } from '../../../../../store/workloadFactory/createNewDBSlice';
import { ReactComponent as Bullet } from '../../../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../../../utils/appConstants';
import { useDelayedError } from '../../../../../common/hooks/useDelayedError';
import AccordionError from '../../../../../common/AccordionError/AccordionError';
import { setDbCreatePressed } from '../../../../../store/mssql/msSqlActionSlice';
import { useEffect, useRef } from 'react';
import { isValidDatabaseName } from '../../../CreateNewDBFooter/createUserDBPayload';

const DatabaseName = () => {
    const nameRef = useRef(null);
    const dispatch = useDispatch();
    const accordionContext = useAccordionContext()?.setOpenChildren!;
    const newUserDBName = useAppSelector(state => state.createNewUser.newUserDBName);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    const isDbCreatePresed = useAppSelector(state => state.msSqlAction.isDbCreatePressed);
    const isDbCreateHit = useAppSelector(state => state.msSqlAction.isDbCreateHit);
    const dbCreateNameAdded = useAppSelector(state => state.msSqlAction.dbCreateNameAdded);
    const dbCreateDataNameAdded = useAppSelector(state => state.msSqlAction.dbCreateDataNameAdded);
    const dbCreateLogNameAdded = useAppSelector(state => state.msSqlAction.dbCreateLogNameAdded);
    const dbCreateDataSizeValid = useAppSelector(state => state.msSqlAction.dbCreateDataSizeValid);
    const dbCreateLogSizeValid = useAppSelector(state => state.msSqlAction.dbCreateLogSizeValid);

    useEffect(() => {
        // by default Database Name accordion will be opened
        accordionContext({
            1: true
        });
    }, []);

    useEffect(() => {
        if (
            isDbCreatePresed &&
            (!dbCreateNameAdded ||
                !dbCreateDataNameAdded ||
                !dbCreateLogNameAdded ||
                !dbCreateDataSizeValid ||
                !dbCreateLogSizeValid)
        ) {
            accordionContext({
                1: !dbCreateNameAdded ? true : false,
                3: !dbCreateDataNameAdded || !dbCreateLogNameAdded ? true : false,
                4: !dbCreateDataSizeValid || !dbCreateLogSizeValid ? true : false
            });
            dispatch(setDbCreatePressed(false));
        }
    }, [
        accordionContext,
        isDbCreatePresed,
        dbCreateNameAdded,
        dbCreateDataNameAdded,
        dbCreateLogNameAdded,
        dbCreateDataSizeValid,
        dbCreateLogSizeValid
    ]);

    useEffect(() => {
        if (!dbCreateNameAdded && isDbCreateHit) {
            setTimeout(() => {
                //@ts-ignore
                nameRef?.current?.focus();
            }, 110);
        }
    }, [dbCreateNameAdded, isDbCreateHit]);

    //Set the Header text here
    const setHeader = () => {
        if (!newUserDBName) {
            return <ActionRequired error={!dbCreateNameAdded ? true : false} />;
        } else if (isValidDBName()) {
            return <AccordionError />;
        } else if (newUserDBName) {
            return (
                <DsTypography variant="Regular_14" className={styles.headerWrap} title={newUserDBName}>
                    {newUserDBName}
                </DsTypography>
            );
        }
        return <ActionRequired error={false} />;
    };

    function isValidDBName() {
        if (isDemoMode) {
            return '';
        }
        if (!dbCreateNameAdded && (!newUserDBName || newUserDBName.length === 0)) {
            return GENERAL.ACTION_REQUIRED;
        }
        return isValidDatabaseName(newUserDBName) ? '' : GENERAL.DB_NAME_ERROR_CHECK;
    }

    return (
        <div className={styles.dataBaseName}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="1"
                title={<div className={CommonStyles.title}>{GENERAL.DB_CREATE_DATABASE_NAME}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.dbNameField}>
                            <TextField
                                ref={nameRef}
                                info={
                                    <div className={styles.dbNameTooltip}>
                                        <div className={styles.listItem}>
                                            <Bullet />
                                            <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                {GENERAL.CREATE_DB_NAME_TOOLTIP[0]}
                                            </DsTypography>
                                        </div>
                                        <div className={styles.listItem}>
                                            <Bullet />
                                            <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                {GENERAL.CREATE_DB_NAME_TOOLTIP[1]}
                                            </DsTypography>
                                        </div>
                                        <div className={styles.listItem}>
                                            <Bullet />
                                            <DsTypography variant="Regular_13" className={styles.textWidth}>
                                                {GENERAL.CREATE_DB_NAME_TOOLTIP[2]}
                                            </DsTypography>
                                        </div>
                                    </div>
                                }
                                label="Database name"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setNewUserDBName(e.target.value));
                                }}
                                value={newUserDBName}
                                error={useDelayedError(isValidDBName())}
                            />
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseName;
