import { useEffect, useState } from 'react';
import { AccordionCard, AccordionCardContent, TextField, Typography } from '@netapp/design-system';
import styles from './PostgreServerName.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { setPostgreServerName } from '../../../store/postgre/postgreFormSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';

const PostgreServerName = () => {
    const userName = useAppSelector(state => state.postgreForm.postgreServerName);
    const [credName, setCredName] = useState('pgsqlserver');
    const dispatch = useDispatch();

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
                                label={'Database server name'}
                                // error={useDelayedError(isValidUserName(credName))}
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
