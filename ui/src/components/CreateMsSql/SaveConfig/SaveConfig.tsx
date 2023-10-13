import { TextField, Typography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setSaveConfigName } from '../../../store/mssql/mssqlFormSlice';
import { GENERAL } from '../../../utils/appConstants';
//@ts-ignore
import sanitizeHTML from 'sanitize-html';
import styles from './SaveConfig.module.scss';

const SaveConfig = () => {
    const [configName, setConfigName] = useState('');
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(setSaveConfigName(configName));
    });

    return (
        <div className={styles['save-config']}>
            <Typography variant="Regular_14">{GENERAL.SAVE_CONFIG_CONTENT}</Typography>
            <TextField
                label={GENERAL.CONFIG_NAME}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setConfigName(sanitizeHTML(e.target.value));
                    dispatch(setSaveConfigName(sanitizeHTML(e.target.value)));
                }}
                value={configName}
                className={styles.textField}
            />
        </div>
    );
};

export default SaveConfig;
