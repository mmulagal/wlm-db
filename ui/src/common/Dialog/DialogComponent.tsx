import {
    Button,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogLayout,
    TooltipInfo,
    useDialog
} from '@netapp/design-system';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../store/storeHooks';
import { ASSESSMENT_CONFIG_NAMES, FROM_DIALOG } from '../../utils/consts';
import styles from './DialogComponent.module.scss';
import { isValidSqlUsername } from '../../utils/utilityFunctions';
import { ReactComponent as ErrorIcon } from '../../assets/error-icon.svg';
import { DsTypography } from '@tlveng/wlm-ds';

type DialogProps = {
    header: string | any;
    content: ReactNode | string;
    primaryButton?: string;
    secondaryButton?: string;
    callback?: any;
    closeCallback?: any;
    dialogFrom?: string;
    customClass?: string;
    primaryButtonDisabled?: boolean;
    hidePrimaryButton?: boolean;
    primaryButtonTooltip?: string;
    testId?: string;
};

const DialogComponent = ({
    header,
    content,
    primaryButton,
    secondaryButton,
    callback,
    closeCallback,
    dialogFrom,
    customClass,
    primaryButtonDisabled = false,
    hidePrimaryButton = false,
    primaryButtonTooltip = '',
    testId
}: DialogProps) => {
    const { closeDialog } = useDialog();
    const { t } = useTranslation();

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const isSaveConfigLoading = useAppSelector(state => state.msSqlAction.isSaveConfigLoading);
    const saveConfigName = useAppSelector(state => state.mssqlForm.saveConfigName);
    const saveConfigFromSaving = useAppSelector(state => state.exploreSavings.saveConfigName);
    const { configData } = useAppSelector(state => state.mssql.getSavedConfigList);
    const { isRollbackSelected, selectedRollbackSnapshot } = useAppSelector(state => state.sandbox);
    const { selectedSnapshotPolicy, selectedAWSBackup } = useAppSelector(state => state.getWellOptimize);
    const { selectedOptimizeConfig, protectionStatus } = useAppSelector(state => state.inventoryV2);
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    const { password, confirmPassword } = useAppSelector(state => {
        if (dialogFrom === FROM_DIALOG.FSXADMIN) {
            return state.workloadFactoryResource.fsxAdminPasswords;
        }
        if (dialogFrom === FROM_DIALOG.SQLSERVER) {
            return state.workloadFactoryResource.sqlServerPasswords;
        }
        return { password: '', confirmPassword: '' };
    });
    const { sqlServerUserName } = useAppSelector(state => state.workloadFactoryResource);
    const { passwordResetLoading } = useAppSelector(state => state.workloadFactoryResource);

    // To show loader on primary button in load config and save config dialog
    const primaryButtonLoad = (() =>
        (dialogFrom === FROM_DIALOG.LOAD_CONFIG && isLoadConfig) ||
        ((dialogFrom === FROM_DIALOG.SAVE_CONFIG || dialogFrom === FROM_DIALOG.HEADER_CROSS) && isSaveConfigLoading) ||
        (dialogFrom === FROM_DIALOG.FSXADMIN && passwordResetLoading) ||
        (dialogFrom === FROM_DIALOG.SQLSERVER && passwordResetLoading))();

    // Load and save config dialog will be closed once data is available. So closeDialog is taken care in LoadConfiguration.ts file.
    const primaryButtonClick = () => {
        callback();
        if (
            dialogFrom !== FROM_DIALOG.LOAD_CONFIG &&
            dialogFrom !== FROM_DIALOG.SAVE_CONFIG &&
            dialogFrom !== FROM_DIALOG.HEADER_CROSS &&
            dialogFrom !== FROM_DIALOG.FSXADMIN &&
            dialogFrom !== FROM_DIALOG.SQLSERVER &&
            dialogFrom !== FROM_DIALOG.SINGLE_AGENT
        ) {
            closeDialog();
        }
    };

    // Redirect to CM page on cancel click when save config is opened via header cross.
    const secButtonClick = () => {
        closeCallback();
        closeDialog(null);
    };

    // Data check for AWS backup dialog
    const dataCheckForAWSBackup = () => {
        if (
            Number(selectedAWSBackup?.numberOfDays) < 1 ||
            Number(selectedAWSBackup?.numberOfDays) > 90 ||
            Number(selectedAWSBackup?.hour) < 1 ||
            Number(selectedAWSBackup?.hour) > 24 ||
            Number(selectedAWSBackup?.minute) < 0 ||
            Number(selectedAWSBackup?.minute) > 59
        ) {
            return true;
        }
        return false;
    };

    const refreshSandboxDisabled =
        dialogFrom === FROM_DIALOG.SANDBOX_REFRESH && isRollbackSelected && !selectedRollbackSnapshot;

    const disabledCheck = () => {
        //SC integration step 1 dialog
        if (dialogFrom === FROM_DIALOG.SINGLE_AGENT && protectionStatus === 'started') {
            return true;
        }
        // Condition to disable Apply in FSX Admin and SQL Server password dialogs
        if (
            (dialogFrom === FROM_DIALOG.SQLSERVER &&
                ((password.length === 0 && confirmPassword.length === 0) ||
                    sqlServerUserName.length === 0 ||
                    password !== confirmPassword)) ||
            isValidSqlUsername(sqlServerUserName, t)
        ) {
            return true;
        }
        if (
            dialogFrom === FROM_DIALOG.FSXADMIN &&
            ((password.length === 0 && confirmPassword.length === 0) || password !== confirmPassword)
        ) {
            return true;
        }
        // Condition to disable primary button for AWS backup dialog
        if (
            dialogFrom === FROM_DIALOG.OPTIMIZE &&
            (selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS ||
                selectedConfig === ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS) &&
            dataCheckForAWSBackup()
        ) {
            return true;
        }
        if (
            dialogFrom === FROM_DIALOG.OPTIMIZE &&
            (selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT ||
                selectedConfig === ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT) &&
            (selectedSnapshotPolicy === null || selectedSnapshotPolicy?.length === 0)
        ) {
            return true;
        }
        if (primaryButtonDisabled) {
            return true;
        }
        return (
            ((dialogFrom === FROM_DIALOG.SAVE_CONFIG || dialogFrom === FROM_DIALOG.HEADER_CROSS) &&
                saveConfigName === '' &&
                saveConfigFromSaving === '') ||
            (dialogFrom === FROM_DIALOG.LOAD_CONFIG && (!configData || configData.length === 0))
        );
    };

    const setClassName = () => {
        if (customClass?.includes('innerPage')) {
            return styles.innerPageClass;
        }
        if (customClass?.includes('protectionDialog')) {
            return styles.protectionDialog;
        }
        return customClass;
    };

    return (
        <DialogLayout className={setClassName()}>
            <DialogHeader>{header}</DialogHeader>
            <DialogContent>{content}</DialogContent>
            <DialogFooter>
                {/* Error condition will come here */}
                {false && (
                    <div className={styles.errorMsg}>
                        <ErrorIcon className={styles.errorIcon} />
                        <DsTypography variant="Semibold_14">Error:</DsTypography>&nbsp;
                        <DsTypography variant="Regular_14" className={styles.errorMsgText}>
                            'Error text'
                        </DsTypography>
                        <div className={styles.dialogFooterDialog}>
                            <TooltipInfo>Text</TooltipInfo>
                        </div>
                    </div>
                )}

                {!hidePrimaryButton && (
                    <Button
                        variant="primary"
                        className="continue-button"
                        isThin
                        isDisabled={disabledCheck() || refreshSandboxDisabled}
                        isLoading={primaryButtonLoad}
                        onClick={primaryButtonClick}
                        title={primaryButtonTooltip}
                        data-testid={testId}
                    >
                        {primaryButton}
                    </Button>
                )}

                {secondaryButton && (
                    <Button variant="secondary" isThin onClick={secButtonClick}>
                        {secondaryButton}
                    </Button>
                )}
            </DialogFooter>
        </DialogLayout>
    );
};

export default DialogComponent;
