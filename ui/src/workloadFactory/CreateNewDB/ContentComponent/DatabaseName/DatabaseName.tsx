import { AccordionCard, AccordionCardContent, DsTypography, TextField, Typography } from '@netapp/design-system';

import styles from './DatabaseName.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setNewUserDBName } from '../../../../store/workloadFactory/createNewDBSlice';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';
import AccordionError from '../../../../common/AccordionError/AccordionError';

const DatabaseName = () => {
    const dispatch = useDispatch();
    const newUserDBName = useAppSelector(state => state.createNewUser.newUserDBName);
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);

    //Set the Header text here
    const setHeader = () => {
        if (isValidDBName()) {
            return <AccordionError />;
        } else if (newUserDBName) {
            return <DsTypography variant="Regular_14">{newUserDBName}</DsTypography>;
        } 
        return <ActionRequired error={false} />;
    };

    function isValidDBName() {
        if (isDemoMode) {
            return '';
        }
        if (
            newUserDBName &&
            newUserDBName.length > 0 &&
            (newUserDBName.length > 30 || !/^[a-zA-Z0-9/_]+$/.test(newUserDBName))
        ) {
            return GENERAL.CREATE_DB_NAME_TOOLTIP.join('');
        }
    }

    return (
        <div className={styles.dataBaseName}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="1"
                title={<div className={CommonStyles.title}>{'Database name'}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.dbNameField}>
                            <TextField
                                info={
                                    <div className={styles.dbNameTooltip}>
                                        <div className={styles.listItem}>
                                            <Bullet />
                                            <DsTypography variant='Regular_13' className={styles.textWidth}>{GENERAL.CREATE_DB_NAME_TOOLTIP[0]}</DsTypography>
                                        </div>
                                        <div className={styles.listItem}>
                                            <Bullet />
                                            <DsTypography variant='Regular_13' className={styles.textWidth}>{GENERAL.CREATE_DB_NAME_TOOLTIP[1]}</DsTypography>
                                        </div>
                                        <div className={styles.listItem}>
                                            <Bullet />
                                            <DsTypography variant='Regular_13' className={styles.textWidth}>{GENERAL.CREATE_DB_NAME_TOOLTIP[2]}</DsTypography>
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
