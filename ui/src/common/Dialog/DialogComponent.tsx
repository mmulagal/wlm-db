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
import { ASSESSMENT_CONFIG_NAMES, ASSESSMENT_CONFIG_IDS, FROM_DIALOG, isValidSsmArn } from '../../utils/consts';
import styles from './DialogComponent.module.scss';
// eslint-disable-next-line import/no-cycle
import { isValidSqlUsername, checkCustomTimeframeExceedsCurrentTime } from '../../utils/utilityFunctions';
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
        dialogTooltip: { showTooltipInfo = false, tooltipText = '' } = {},
        actionsDisabled,
        requireAcknowledge
    } = useAppSelector(state => state.dialogComponent);

    const { configData } = useAppSelector(state => state.mssql.getSavedConfigList);
    const { isRollbackSelected, selectedRollbackSnapshot } = useAppSelector(state => state.sandbox);
    const { selectedSnapshotPolicy, selectedAWSBackup } = useAppSelector(state => state.getWellOptimize);
    const { selectedOptimizeConfig } = useAppSelector(state => state.inventoryV2);
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    const detectReplicaHostLoading = useAppSelector(state => state.msSqlAction.isDetectReplicaHostLoading);
    const associateLinkLoading = useAppSelector(state => state.crrRedirection.associateLinkLoading);
    const crrPrefetchLoading = useAppSelector(state => state.crrRedirection.crrPrefetchLoading);

    const {
        durationCustomAnalysis,
        selectedCustomAnalysisTime,
        selectedCustomAnalysisTimeFrameUnit,
        startCustomAnalysisTime
    } = useAppSelector(state => state.agenticAI);

    // Memoize the password object to prevent unnecessary re-renders
    const sqlServerPasswords = useAppSelector(state => state.workloadFactoryResource.sqlServerPasswords);

    const { password, confirmPassword } = useMemo(() => {
        if (dialogFrom === FROM_DIALOG.SQLSERVER) {
            return sqlServerPasswords;
        }
        return { password: '', confirmPassword: '' };
    }, [dialogFrom, sqlServerPasswords]);

    const { sqlServerUserName, credentialUpdateSsmArn } = useAppSelector(state => state.workloadFactoryResource);
    const { passwordResetLoading } = useAppSelector(state => state.workloadFactoryResource);
    const {
        userName: exploreSavingsUserName,
        password: exploreSavingsPassword,
        ssmParameterArn: exploreSavingsSsmArn
    } = useAppSelector(state => state.exploreSavings.serverDetails);
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);
    const { username: scUsername, password: scPassword } = useAppSelector(state => state.snapCenter.credentials);
    const { authVerification } = useAppSelector(state => state.snapCenter);
    const {
        bulkAuthCredentials,
        rowsRequiringAuthBulk,
        partialDataBannerAuthHostIds,
        partialDataBannerSelectedAuthHostIds
    } = useAppSelector(state => state.exploreSavingsBulk);

    // Track if this is a bulk explore savings case
    const isBulkExploreSavings = useRef(false);

    const checkBulkCredentialsFilled = (rowsToCheck: any[]) =>
        rowsToCheck.every((row: any) => {
            const credentials = bulkAuthCredentials[row.name];
            if (!credentials) return false;
            if (isGovAccount) {
                return isValidSsmArn(credentials.ssmParameterArn || '');
            }
            return (
                credentials.userName &&
                credentials.userName.length > 0 &&
                credentials.password &&
                credentials.password.length > 0
            );
        });

    const checkExploreSavingsDisabled = () => {
        if (rowsRequiringAuthBulk && rowsRequiringAuthBulk.length > 0) {
            isBulkExploreSavings.current = true;
            return !checkBulkCredentialsFilled(rowsRequiringAuthBulk);
        }

        isBulkExploreSavings.current = false;
        if (
            (partialDataBannerAuthHostIds?.length ?? 0) > 1 &&
            (partialDataBannerSelectedAuthHostIds?.length ?? 0) === 0
        ) {
            return true;
        }
        if (isGovAccount) {
            return !isValidSsmArn(exploreSavingsSsmArn);
        }
        return exploreSavingsUserName.length === 0 || exploreSavingsPassword.length === 0;
    };

    // To show loader on primary button in load config and save config dialog
    const primaryButtonLoad = (() =>
        (dialogFrom === FROM_DIALOG.MANAGE_WIZARD && detectReplicaHostLoading) ||
        (dialogFrom === FROM_DIALOG.LOAD_CONFIG && isLoadConfig) ||
        ((dialogFrom === FROM_DIALOG.SAVE_CONFIG || dialogFrom === FROM_DIALOG.HEADER_CROSS) && isSaveConfigLoading) ||
        (dialogFrom === FROM_DIALOG.SQLSERVER && passwordResetLoading) ||
        (dialogFrom === FROM_DIALOG.EXPLORE_SAVINGS && actionsDisabled) ||
        (dialogFrom === FROM_DIALOG.WINDOWS_AUTH && authVerification) ||
        (dialogFrom === FROM_DIALOG.SINGLE_AGENT && actionsDisabled) ||
        (dialogFrom === FROM_DIALOG.CRR_REDIRECTION && associateLinkLoading) ||
        (dialogFrom === FROM_DIALOG.OPTIMIZE &&
            selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_IDS.CRR &&
            crrPrefetchLoading))();

    // Load and save config dialog will be closed once data is available. So closeDialog is taken care in LoadConfiguration.ts file.
    const primaryButtonClick = () => {
        callback();
        if (
            !requireAcknowledge &&
            dialogFrom !== FROM_DIALOG.LOAD_CONFIG &&
            dialogFrom !== FROM_DIALOG.SAVE_CONFIG &&
            dialogFrom !== FROM_DIALOG.HEADER_CROSS &&
            dialogFrom !== FROM_DIALOG.SQLSERVER &&
            dialogFrom !== FROM_DIALOG.SINGLE_AGENT &&
            dialogFrom !== FROM_DIALOG.EXPLORE_SAVINGS &&
            dialogFrom !== FROM_DIALOG.WINDOWS_AUTH &&
            dialogFrom !== FROM_DIALOG.MANAGE_WIZARD &&
            dialogFrom !== FROM_DIALOG.CRR_REDIRECTION &&
            !(
                dialogFrom === FROM_DIALOG.OPTIMIZE &&
                (selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_IDS.CRR ||
                    selectedOptimizeConfig?.type === ASSESSMENT_CONFIG_IDS.SNAPCENTER_SNAPSHOT)
            )
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
        // Disable for custom timeframe if duration is empty, exceeds 24 hours, or exceeds current time for today's date
        if (
            dialogFrom === FROM_DIALOG.CUSTOM_TIMEFRAME &&
            ((typeof durationCustomAnalysis === 'string' && durationCustomAnalysis.length === 0) ||
                Number(durationCustomAnalysis) > 24 ||
                checkCustomTimeframeExceedsCurrentTime(
                    startCustomAnalysisTime,
                    selectedCustomAnalysisTime,
                    selectedCustomAnalysisTimeFrameUnit,
                    durationCustomAnalysis
                ))
        ) {
            return true;
        }
        if (dialogFrom === FROM_DIALOG.SQLSERVER) {
            if (isGovAccount) {
                return !isValidSsmArn(credentialUpdateSsmArn);
            }
            if (
                (password.length === 0 && confirmPassword.length === 0) ||
                sqlServerUserName.length === 0 ||
                password !== confirmPassword ||
                isValidSqlUsername(sqlServerUserName, t)
            ) {
                return true;
            }
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
        if (customClass?.includes('oneTimeWADDialog')) {
            return styles.oneTimeWADDialog;
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
                                <TooltipInfo>{tooltipText}</TooltipInfo>
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
                        title={
                            primaryButtonTooltip && (
                                <DsTypography variant="Regular_13" style={{ maxWidth: '300px' }}>
                                    {primaryButtonTooltip}
                                </DsTypography>
                            )
                        }
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
