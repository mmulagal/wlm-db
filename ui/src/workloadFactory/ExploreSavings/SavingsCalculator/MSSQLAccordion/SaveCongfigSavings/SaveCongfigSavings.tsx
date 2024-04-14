import { DsTypography, TextField } from '@netapp/design-system';
import styles from './SaveConfigSavings.module.scss';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
//@ts-ignore
import sanitizeHTML from 'sanitize-html';
import { GENERAL } from '../../../../../utils/appConstants';
import { setSaveConfigName } from '../../../../../store/workloadFactory/exploreSavingsSlice';

const SaveConfigSavings = ({ description }: any) => {
    const [configName, setConfigName] = useState('');
    const dispatch = useDispatch();
    return (
        <div className={styles.saveConfigSaving}>
            <DsTypography variant="Regular_14">{description}</DsTypography>
            <TextField
                label={GENERAL.CONFIG_NAME}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setConfigName(sanitizeHTML(e.target.value));
                    dispatch(setSaveConfigName(e.target.value));
                }}
                value={configName}
                className={styles.textField}
            />
        </div>
    );
};

export default SaveConfigSavings;
