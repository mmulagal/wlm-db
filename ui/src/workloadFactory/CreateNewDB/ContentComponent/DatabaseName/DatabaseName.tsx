import { AccordionCard, AccordionCardContent, DsTypography, TextField } from '@netapp/design-system';

import styles from './DatabaseName.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { useState } from 'react';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { setNewUserDBName } from '../../../../store/workloadFactory/createNewDBSlice';

const DatabaseName = () => {
    const dispatch = useDispatch();
    const newUserDBName = useAppSelector(state => state.createNewUser.newUserDBName);
    //Set the Header text here
    const setHeader = () => {
        if (newUserDBName) {
            return <DsTypography variant="Regular_14">{newUserDBName}</DsTypography>;
        }
        return <ActionRequired error={false} />;
    };
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
                                label="Database name"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setNewUserDBName(e.target.value));
                                }}
                                value={newUserDBName}
                            />
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseName;
