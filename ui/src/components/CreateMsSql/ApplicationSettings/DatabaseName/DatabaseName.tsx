import { useEffect, useState } from 'react';
import { AccordionCard, AccordionCardContent, TextField, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './DatabaseName.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import AccordionError from '../../../../common/AccordionError/AccordionError';
import { useDispatch } from 'react-redux';
import { setDBName } from '../../../../store/mssql/mssqlFormSlice';
import { SQL_DATABASE } from '../../../../utils/consts';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';

const DatabaseName = () => {
    const [input, setInput] = useState(SQL_DATABASE);
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(setDBName(input));
    });

    function isValidDBName() {
        const firstChar = input.charAt(0);
        // Check if the instance name is 16 characters or less in length

        if (
            input.length > 0 &&
            (input.length > 15 || !/^[a-zA-Z_#&]/.test(firstChar) || !/^[a-zA-Z0-9_#&]+$/.test(input))
        ) {
            return GENERAL.DB_NAME_TOOLTIP;
        }
    }
    //Set the Header text here
    const setHeader = () => {
        if (isValidDBName()) {
            return <AccordionError />;
        } else {
            return <Typography variant="Regular_14">{input}</Typography>;
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
                                info={GENERAL.DB_NAME_TOOLTIP}
                                label={GENERAL.DATABASE_INSTANCE_NAME}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setInput(e.target.value);
                                    dispatch(setDBName(e.target.value));
                                }}
                                error={useDelayedError(isValidDBName())}
                                value={input}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default DatabaseName;
