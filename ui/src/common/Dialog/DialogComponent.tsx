import {
    Button,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogLayout,
    TooltipInfo,
    useDialog
} from '@netapp/design-system';
import { ReactNode, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { useAppSelector } from '../../store/storeHooks';
import { ASSESSMENT_CONFIG_NAMES, FROM_DIALOG } from '../../utils/consts';
import styles from './DialogComponent.module.scss';
// eslint-disable-next-line import/no-cycle
import { isValidSqlUsername } from '../../utils/utilityFunctions';
import { ReactComponent as ErrorIcon } from '../../assets/error-icon.svg';
import { ReactComponent as ActionRequiredIcon } from '../../assets/action-required.svg';

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
    const {
        dialogError: { showDialogError = false, errorMessage = '' } = {},
        dialogTooltip: { showTooltipInfo = false, tooltipText = '', showBullets = false, bulletPoints = [] } = {},
        actionsDisabled
    } = useAppSelector(state => state.dialogComponent);

    const { configData } = useAppSelector(state => state.mssql.getSavedConfigList);
    const { isRollbackSelected, selectedRollbackSnapshot } = useAppSelector(state => state.sandbox);
    const { selectedSnapshotPolicy, selectedAWSBackup } = useAppSelector(state => state.getWellOptimize);
    const { selectedOptimizeConfig } = useAppSelector(state => state.inventoryV2);
    const { selectedConfig } = useAppSelector(state => state.databaseHome);

    // Memoize the password object to prevent unnecessary re-renders
    const fsxAdminPasswords = useAppSelector(state => state.workloadFactoryResource.fsxAdminPasswords);
    const sqlServerPasswords = useAppSelector(state => state.workloadFactoryResource.sqlServerPasswords);

    const { password, confirmPassword } = useMemo(() => {
        if (dialogFrom === FROM_DIALOG.FSXADMIN) {
            return fsxAdminPasswords;
        }
        if (dialogFrom === FROM_DIALOG.SQLSERVER) {
            return sqlServerPasswords;
        }
        return { password: '', confirmPassword: '' };
    }, [dialogFrom, fsxAdminPasswords, sqlServerPasswords]);

    const { sqlServerUserName } = useAppSelector(state => state.workloadFactoryResource);
    const { passwordResetLoading } = useAppSelector(state => state.workloadFactoryResource);
    const { userName: exploreSavingsUserName, password: exploreSavingsPassword } = useAppSelector(
        state => state.exploreSavings.serverDetails
    );
    const { username: scUsername, password: scPassword } = useAppSelector(state => state.snapCenter.credentials);
    const { authVerification } = useAppSelector(state => state.snapCenter);
    const { bulkAuthCredentials, rowsRequiringAuthBulk, selectedRowsForExploreSavingsEBSBulk } = useAppSelector(
        state => state.exploreSavingsBulk
    );

    // Track if this is a bulk explore savings case
    const isBulkExploreSavings = useRef(false);

    // Check if all bulk credentials are filled for explore savings
    const checkBulkCredentialsFilled = (rowsToCheck: any[]) => {
        return rowsToCheck.every((row: any) => {
            const credentials = bulkAuthCredentials[row.name];
            return (
                credentials &&
                credentials.userName &&
                credentials.userName.length > 0 &&
                credentials.password &&
                credentials.password.length > 0
            );
        });
    };

    // Check if explore savings credentials are disabled
    const checkExploreSavingsDisabled = () => {
        // Check if it's a bulk operation (multiple hosts requiring auth)
        const rowsToCheck =
            rowsRequiringAuthBulk && rowsRequiringAuthBulk.length > 0
                ? rowsRequiringAuthBulk
                : selectedRowsForExploreSavingsEBSBulk;

        // If we have bulk credentials to check (bulk case)
        if (rowsToCheck && rowsToCheck.length > 0) {
            // Set flag for bulk explore savings case
            isBulkExploreSavings.current = true;

            // Check if all hosts have both username and password filled
            const allCredentialsFilled = checkBulkCredentialsFilled(rowsToCheck);

            // Disable if not all credentials are filled
            return !allCredentialsFilled;
        }

        // Otherwise, it's a single auth case - check single credentials
        isBulkExploreSavings.current = false;
        return exploreSavingsUserName.length === 0 || exploreSavingsPassword.length === 0;
    };

    // To show loader on primary button in load config and save config dialog
    const primaryButtonLoad = (() =>
        (dialogFrom === FROM_DIALOG.LOAD_CONFIG && isLoadConfig) ||
        ((dialogFrom === FROM_DIALOG.SAVE_CONFIG || dialogFrom === FROM_DIALOG.HEADER_CROSS) && isSaveConfigLoading) ||
        (dialogFrom === FROM_DIALOG.FSXADMIN && passwordResetLoading) ||
        (dialogFrom === FROM_DIALOG.SQLSERVER && passwordResetLoading) ||
        (dialogFrom === FROM_DIALOG.EXPLORE_SAVINGS && actionsDisabled) ||
        (dialogFrom === FROM_DIALOG.WINDOWS_AUTH && authVerification) ||
        (dialogFrom === FROM_DIALOG.SINGLE_AGENT && actionsDisabled))();

    // Load and save config dialog will be closed once data is available. So closeDialog is taken care in LoadConfiguration.ts file.
    const primaryButtonClick = () => {
        callback();
        if (
            dialogFrom !== FROM_DIALOG.LOAD_CONFIG &&
            dialogFrom !== FROM_DIALOG.SAVE_CONFIG &&
            dialogFrom !== FROM_DIALOG.HEADER_CROSS &&
            dialogFrom !== FROM_DIALOG.FSXADMIN &&
            dialogFrom !== FROM_DIALOG.SQLSERVER &&
            dialogFrom !== FROM_DIALOG.SINGLE_AGENT &&
            dialogFrom !== FROM_DIALOG.EXPLORE_SAVINGS &&
            dialogFrom !== FROM_DIALOG.WINDOWS_AUTH
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
        if (dialogFrom === FROM_DIALOG.LOADER) {
            return true;
        }
        if (dialogFrom === FROM_DIALOG.WINDOWS_AUTH && (scUsername.length === 0 || scPassword.length === 0)) {
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
        if (dialogFrom === FROM_DIALOG.EXPLORE_SAVINGS) {
            return checkExploreSavingsDisabled();
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
                {/* Show error message if showDialogError is true which is stored in dialogComponentSlice so that the DialogComponents reloads when there is a change */}
                {showDialogError && (
                    <div className={isBulkExploreSavings.current ? styles.errorMsgBulk : styles.errorMsg}>
                        {isBulkExploreSavings.current ? (
                            <ActionRequiredIcon className={styles.errorIcon} />
                        ) : (
                            <ErrorIcon className={styles.errorIcon} />
                        )}
                        <DsTypography variant="Semibold_14">
                            {isBulkExploreSavings.current ? 'Notice:' : 'Error:'}
                        </DsTypography>
                        &nbsp;
                        <DsTypography variant="Regular_14" className={styles.errorMsgText}>
                            {errorMessage}
                        </DsTypography>
                        {showTooltipInfo && (
                            <div
                                className={
                                    isBulkExploreSavings.current
                                        ? styles.dialogFooterDialogBulk
                                        : styles.dialogFooterDialog
                                }
                            >
                                <TooltipInfo>
                                    {tooltipText && (
                                        <div style={isBulkExploreSavings.current ? { fontWeight: 500 } : undefined}>
                                            {tooltipText}
                                        </div>
                                    )}
                                    {showBullets && bulletPoints && bulletPoints.length > 0 && (
                                        <ul style={{ marginTop: tooltipText ? '8px' : '0', paddingLeft: '20px' }}>
                                            {bulletPoints.map((bullet, index) => (
                                                <li key={index}>{bullet}</li>
                                            ))}
                                        </ul>
                                    )}
                                </TooltipInfo>
                            </div>
                        )}
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
