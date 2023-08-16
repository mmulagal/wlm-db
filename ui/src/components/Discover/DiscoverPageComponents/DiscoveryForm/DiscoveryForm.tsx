import { Typography, TextField, PasswordField } from '@netapp/design-system';
import { SelectField } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './DiscoveryForm.module.scss';

const DiscoveryForm = () => {
    const authOptions = [
        { label: 'Windows Authentication', value: 'windows' },
        { label: 'Mixed Mode', value: 'mixed' }
    ];

    return (
        <div className={styles.form}>
            <Typography variant="Semibold_16" className={styles.heading}>
                {GENERAL.DISCOVER_FORM_HEADING}
            </Typography>
            <TextField
                label={GENERAL.IP_DOMAIN}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    console.log(e.target.value);
                }}
                error={''}
                className={styles.fieldContainer}
            />
            <SelectField
                label={GENERAL.AUTHENTICATION_TYPE}
                isClearable={false}
                onChange={(selectedOptions: any): void => {
                    console.log(selectedOptions);
                }}
                isSearchable={false}
                options={authOptions}
                className={styles.fieldContainer}
            />
            <TextField
                label={GENERAL.USER_NAME}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    console.log(e.target.value);
                }}
                error={''}
                className={styles.fieldContainer}
            />
            <PasswordField
                label={GENERAL.PASSWORD}
                error={''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    console.log(e);
                }}
                className={styles.fieldContainer}
            />
        </div>
    );
};

export default DiscoveryForm;
