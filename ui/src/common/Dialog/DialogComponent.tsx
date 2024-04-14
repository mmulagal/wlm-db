import {
    Button,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogLayout,
    DsTypography,
    TooltipInfo,
    useDialog
} from '@netapp/design-system';
import { ReactNode } from 'react';
import { useAppSelector } from '../../store/storeHooks';
import { FROM_DIALOG } from '../../utils/consts';
import styles from './DialogComponent.module.scss';
import { ReactComponent as ErrorIcon } from '../../assets/error-icon.svg';
import { GENERAL } from '../../utils/appConstants';

type DialogProps = {
    header: string | any;
    content: ReactNode | string;
    primaryButton: string;
    secondaryButton?: string;
    callback?: any;
    closeCallback?: any;
    dialogFrom?: string;
    customClass?: string;
};

const DialogComponent = ({
    header,
    content,
    primaryButton,
    secondaryButton,
    callback,
    closeCallback,
    dialogFrom,
    customClass
}: DialogProps) => {
    const { closeDialog } = useDialog();

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const isSaveConfigLoading = useAppSelector(state => state.msSqlAction.isSaveConfigLoading);
    const saveConfigName = useAppSelector(state => state.mssqlForm.saveConfigName);
    const saveConfigFromSaving = useAppSelector(state => state.exploreSavings.saveConfigName);
    const { configData } = useAppSelector(state => state.mssql.getSavedConfigList);
    const detectHostError = useAppSelector(state => state.msSqlAction.isDetectHostError);
    const detectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);

    // To show loader on primary button in load config and save config dialog
    const primaryButtonLoad = (() => {
        return (
            (dialogFrom === FROM_DIALOG.LOAD_CONFIG && isLoadConfig) ||
            ((dialogFrom === FROM_DIALOG.SAVE_CONFIG || dialogFrom === FROM_DIALOG.HEADER_CROSS) &&
                isSaveConfigLoading) ||
            (dialogFrom === FROM_DIALOG.DETECT_HOST && detectHostLoading)
        );
    })();

    // Load and save config dialog will be closed once data is available. So closeDialog is taken care in LoadConfiguration.ts file.
    const primaryButtonClick = () => {
        callback();
        if (
            dialogFrom !== FROM_DIALOG.LOAD_CONFIG &&
            dialogFrom !== FROM_DIALOG.SAVE_CONFIG &&
            dialogFrom !== FROM_DIALOG.HEADER_CROSS &&
            dialogFrom !== FROM_DIALOG.DETECT_HOST
        ) {
            closeDialog();
        }
    };

    // Redirect to CM page on cancel click when save config is opened via header cross.
    const secButtonClick = () => {
        closeCallback();
        closeDialog(null);
    };

    const disabledCheck = () => {
        return (
            ((dialogFrom === FROM_DIALOG.SAVE_CONFIG || dialogFrom === FROM_DIALOG.HEADER_CROSS) &&
                saveConfigName === '' &&
                saveConfigFromSaving === '') ||
            (dialogFrom === FROM_DIALOG.LOAD_CONFIG && (!configData || configData.length === 0))
        );
    };

    return (
        <DialogLayout className={customClass}>
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
                        <TooltipInfo>{detectHostError}</TooltipInfo>
                    </div>
                )}

                <Button
                    variant={'primary'}
                    className={'continue-button'}
                    isThin={true}
                    isDisabled={disabledCheck()}
                    isLoading={primaryButtonLoad}
                    onClick={primaryButtonClick}
                >
                    {primaryButton}
                </Button>
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
