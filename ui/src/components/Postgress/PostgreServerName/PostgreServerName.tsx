import { useEffect, useRef, useState } from 'react';
import { AccordionCard, AccordionCardContent, TextField, Typography } from '@netapp/design-system';
import styles from './PostgreServerName.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { setPostgreServerName } from '../../../store/postgre/postgreFormSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { useDelayedError } from '../../../common/hooks/useDelayedError';
import { GENERAL } from '../../../utils/appConstants';

const PostgreServerName = () => {
    const userName = useAppSelector(state => state.postgreForm.postgreServerName);
    const isCreateHit = useAppSelector(state => state.msSqlAction?.isCreateHit);
    const isDBClusterNameFilled = useAppSelector(state => state.msSqlAction?.pgDbNameSelected);
    const [credName, setCredName] = useState('pgsqlserver');
    const dispatch = useDispatch();

    const databasenameRef = useRef(null);

    useEffect(() => {
        setCredName(userName);
    }, [userName]);
    //Set the Header text here
    const setHeader = () => {
        if (!credName) {
            return <ActionRequired />;
        } else {
            return <Typography variant="Regular_14">{credName}</Typography>;
        }
    };

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
        if (!credName || credName.length === 0) {
            return GENERAL.ACTION_REQUIRED;
        }
    }

    return (
        <div className={styles.postgreServerName}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="27"
                title={<div className={CommonStyles.title}>{'Database server name'}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.secondContainer}>
                            <TextField
                                ref={databasenameRef}
                                label={'Database server name'}
                                error={useDelayedError(isValidDBName())}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setCredName(e.target.value);
                                    dispatch(setPostgreServerName(e.target.value));
                                }}
                                value={credName}
                                className={styles.textField}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default PostgreServerName;
