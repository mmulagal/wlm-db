import { TextField, Typography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setSaveConfigName } from '../../../store/mssql/mssqlFormSlice';
import { GENERAL } from '../../../utils/appConstants';
//@ts-ignore
import sanitizeHTML from 'sanitize-html';
import styles from './SaveConfig.module.scss';
import { setIsWizardTouched } from '../../../store/chatbot/chatbotSlice';

type Props = { description: string | null };

const SaveConfig = ({ description }: Props) => {
    const [configName, setConfigName] = useState('');
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(setSaveConfigName(configName));
    });

    return (
        <div className={styles['save-config']}>
            <Typography variant="Regular_14">{description}</Typography>
            <TextField
                label={GENERAL.CONFIG_NAME}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setConfigName(sanitizeHTML(e.target.value));
                    dispatch(setSaveConfigName(sanitizeHTML(e.target.value)));
                    dispatch(setIsWizardTouched(true));
                }}
                value={configName}
                className={styles.textField}
            />
        </div>
    );
};

export default SaveConfig;
