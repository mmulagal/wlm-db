import { DsTypography, PasswordField, Popover, TextField } from '@netapp/design-system';
import styles from './FSXPasswordContent.module.scss';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as TooltipIcon } from '../../../../assets/tooltipGrey.svg';
import {
    setFsxAdminConfirmPassword,
    setFsxAdminPassword,
    setSqlServerConfirmPassword,
    setSqlServerPassword
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDelayedError } from '../../../../common/hooks/useDelayedError';
import { isValidPassword } from '../../../../utils/utilityFunctions';

interface PasswordContentProps {
    type: 'fsx' | 'sql';
    password: string;
    confirmPassword: string;
    setPassword: (value: string) => void;
    setConfirmPassword: (value: string) => void;
    description: string;
    username: string;
}

const PasswordContent = ({
    type,
    password,
    confirmPassword,
    setPassword,
    setConfirmPassword,
    description,
    username
}: PasswordContentProps) => {
    const tooltipText = () => {
        return (
            <DsTypography variant="Regular_13" className={styles.infoMsg}>
                <DsTypography variant="Regular_13">The password must be:</DsTypography>
                <div className={styles.list}>
                    <div className={styles.listItem}>
                        <Bullet />
                        <div className={styles.textWidth}>Between 8 and 50 characters in length.</div>
                    </div>
                    <div className={styles.listItem}>
                        <Bullet />
                        <div className={styles.textWidth}>At least one character and one digit.</div>
                    </div>
                    <div className={styles.listItem}>
                        <Bullet />
                        <div className={styles.textWidth}>Must not contain non-English letters or "admin".</div>
                    </div>
                </div>
            </DsTypography>
        );
    };

    const isValidConfirmPassword = (confirmPassword: string) => {
        if (confirmPassword.length > 0 && password !== confirmPassword) {
            return 'Passwords do not match.';
        }
    };

    return (
        <div className={styles[`${type}-password`]}>
            <DsTypography variant="Regular_14" style={{ width: '800px' }}>
                {description}
            </DsTypography>

            <div className={styles.textArea}>
                <TextField
                    label={GENERAL.USER_NAME}
                    value={username}
                    className={styles.textField}
                    isDisabled={true}
                />

                <div className={styles.tooltipContainer}>
                    <PasswordField
                        label={GENERAL.PASSWORD}
                        error={useDelayedError(isValidPassword(password))}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setPassword(e.target.value);
                        }}
                        value={password}
                        className={styles.textField}
                    />
                    <div className={styles.dialogFooterDialog}>
                        <Popover
                            popoverClass={''}
                            children={tooltipText()}
                            trigger="hover"
                            isAppendedToBody={true}
                            container={<TooltipIcon />}
                        />
                    </div>
                </div>

                <PasswordField
                    label={'Confirm password'}
                    error={useDelayedError(isValidConfirmPassword(confirmPassword))}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setConfirmPassword(e.target.value);
                    }}
                    value={confirmPassword}
                    className={styles.textField}
                />
            </div>
        </div>
    );
};

const FSXPasswordContent = () => {
    const dispatch = useDispatch();
    const { password, confirmPassword } = useAppSelector(state => state.workloadFactoryResource.fsxAdminPasswords);

    return (
        <PasswordContent
            type="fsx"
            password={password}
            confirmPassword={confirmPassword}
            setPassword={(value: string) => dispatch(setFsxAdminPassword(value))}
            setConfirmPassword={(value: string) => dispatch(setFsxAdminConfirmPassword(value))}
            description="The password for the fsxadmin user is required to manage the FSx for ONTAP serving this Microsoft SQL Server instance. Enter a new password."
            username="fsxadmin"
        />
    );
};

const SQLServerPasswordContent = () => {
    const dispatch = useDispatch();
    const { password: sqlPassword, confirmPassword: sqlConfirmPassword } = useAppSelector(
        state => state.workloadFactoryResource.sqlServerPasswords
    );

    return (
        <PasswordContent
            type="sql"
            password={sqlPassword}
            confirmPassword={sqlConfirmPassword}
            setPassword={(value: string) => dispatch(setSqlServerPassword(value))}
            setConfirmPassword={(value: string) => dispatch(setSqlServerConfirmPassword(value))}
            description="The password for the Microsoft SQL Server user is required to manage this instance. Enter a new password."
            username="sqlserver"
        />
    );
};

export { FSXPasswordContent, SQLServerPasswordContent };
export default PasswordContent;
