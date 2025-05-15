import {
    Button,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogLayout,
    DsTypography,
    Popover,
    useDialog
} from '@netapp/design-system';
import { ReactNode } from 'react';
import { useAppSelector } from '../../store/storeHooks';
import { ASSESSMENT_CONFIG_NAMES, FROM_DIALOG } from '../../utils/consts';
import styles from './DialogComponent.module.scss';
import { ReactComponent as ErrorIcon } from '../../assets/error-icon.svg';
import { ReactComponent as TooltipIcon } from '../../assets/tooltipGrey.svg';
import { GENERAL } from '../../utils/appConstants';
import { isValidPassword } from '../../utils/utilityFunctions';

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

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const isSaveConfigLoading = useAppSelector(state => state.msSqlAction.isSaveConfigLoading);
    const saveConfigName = useAppSelector(state => state.mssqlForm.saveConfigName);
    const saveConfigFromSaving = useAppSelector(state => state.exploreSavings.saveConfigName);
    const { configData } = useAppSelector(state => state.mssql.getSavedConfigList);
    const detectHostError = useAppSelector(state => state.msSqlAction.isDetectHostError);
    const detectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);
    const { isRollbackSelected, selectedRollbackSnapshot } = useAppSelector(state => state.sandbox);
    const { selectedSnapshotPolicy, selectedAWSBackup } = useAppSelector(state => state.getWellOptimize);
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const { selectedConfig } = useAppSelector(state => state.databaseHome);
    //const { password, confirmPassword } = useAppSelector(state => state.workloadFactoryResource.fsxAdminPasswords);
    const { password, confirmPassword } = useAppSelector(state => {
        if (dialogFrom === FROM_DIALOG.FSXADMIN) {
            return state.workloadFactoryResource.fsxAdminPasswords;
        } else if (dialogFrom === FROM_DIALOG.SQLSERVER) {
            return state.workloadFactoryResource.sqlServerPasswords;
        }
        return { password: '', confirmPassword: '' }; 
    });
    const { passwordResetLoading } = useAppSelector(state => state.workloadFactoryResource);

    //Managed Host table button disable
    const { manageHostSelectedRows } = useAppSelector(state => state.inventoryV2);

    // To show loader on primary button in load config and save config dialog
    const primaryButtonLoad = (() => {
        return (
            (dialogFrom === FROM_DIALOG.LOAD_CONFIG && isLoadConfig) ||
            ((dialogFrom === FROM_DIALOG.SAVE_CONFIG || dialogFrom === FROM_DIALOG.HEADER_CROSS) &&
                isSaveConfigLoading) ||
            (dialogFrom === FROM_DIALOG.DETECT_HOST && detectHostLoading) ||
            (dialogFrom === FROM_DIALOG.FSXADMIN && passwordResetLoading) ||
            (dialogFrom === FROM_DIALOG.SQLSERVER && passwordResetLoading)
        );
    })();

    // Load and save config dialog will be closed once data is available. So closeDialog is taken care in LoadConfiguration.ts file.
    const primaryButtonClick = () => {
        callback();
        if (
            dialogFrom !== FROM_DIALOG.LOAD_CONFIG &&
            dialogFrom !== FROM_DIALOG.SAVE_CONFIG &&
            dialogFrom !== FROM_DIALOG.HEADER_CROSS &&
            dialogFrom !== FROM_DIALOG.DETECT_HOST &&
            dialogFrom !== FROM_DIALOG.FSXADMIN &&
            dialogFrom !== FROM_DIALOG.SQLSERVER 
        ) {
            closeDialog();
        }
    };

    // Redirect to CM page on cancel click when save config is opened via header cross.
    const secButtonClick = () => {
        closeCallback();
        closeDialog(null);
    };

    //Data check for AWS backup dialog
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
    };

    const refreshSandboxDisabled =
        dialogFrom === FROM_DIALOG.SANDBOX_REFRESH && isRollbackSelected && !selectedRollbackSnapshot;

    const disabledCheck = () => {
        //Condition to disable Apply in FSX Admin and SQL Server password dialogs
        if (
            (dialogFrom === FROM_DIALOG.FSXADMIN || dialogFrom === FROM_DIALOG.SQLSERVER) &&
            ((password.length === 0 && confirmPassword.length === 0) ||
                password !== confirmPassword ||
                isValidPassword(password))
        ) {
                return true;
        }
        //Condition to disable primary button for AWS backup dialog
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
        if (manageHostSelectedRows.length === 0 && dialogFrom === 'managedHost') {
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
        } else {
            return customClass;
        }
    };

    return (
        <DialogLayout className={setClassName()}>
            <DialogHeader>{header}</DialogHeader>
            <DialogContent>{content}</DialogContent>
            <DialogFooter>
                {detectHostError && (
                    <div className={styles.errorMsg}>
                        <ErrorIcon className={styles.errorIcon} />
                        <DsTypography variant="Semibold_13">{GENERAL.ERROR}</DsTypography>&nbsp;
                        <DsTypography variant="Regular_13" className={styles.errorMsgText}>
                            {detectHostError}
                        </DsTypography>
                        <div className={styles.dialogFooterDialog}>
                            <Popover
                                popoverClass={''}
                                children={detectHostError}
                                trigger="hover"
                                delayHide={200}
                                interactive={true}
                                isAppendedToBody={true}
                                container={<TooltipIcon />}
                            />
                        </div>
                    </div>
                )}

                {!hidePrimaryButton && (
                    <Button
                        variant={'primary'}
                        className={'continue-button'}
                        isThin={true}
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
                    <Button variant={'secondary'} isThin={true} onClick={secButtonClick}>
                        {secondaryButton}
                    </Button>
                )}
            </DialogFooter>
        </DialogLayout>
    );
};

export default DialogComponent;
