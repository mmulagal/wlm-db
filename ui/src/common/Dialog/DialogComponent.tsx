import { Button, DialogContent, DialogFooter, DialogHeader, DialogLayout, useDialog } from '@netapp/design-system';
import { ReactNode } from 'react';
import { useAppSelector } from '../../store/storeHooks';
import { FROM_DIALOG } from '../../utils/consts';

type DialogProps = {
    header: string | any;
    content: ReactNode | string;
    primaryButton: string;
    secondaryButton?: string;
    callback?: any;
    closeCallback?: any;
    dialogFrom?: string;
};

const DialogComponent = ({
    header,
    content,
    primaryButton,
    secondaryButton,
    callback,
    closeCallback,
    dialogFrom
}: DialogProps) => {
    const { closeDialog } = useDialog();

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const isSaveConfigLoading = useAppSelector(state => state.msSqlAction.isSaveConfigLoading);
    const saveConfigName = useAppSelector(state => state.mssqlForm.saveConfigName);
    const { configData } = useAppSelector(state => state.mssql.getSavedConfigList);

    // To show loader on primary button in load config and save config dialog
    const primaryButtonLoad = (() => {
        return (
            (dialogFrom === FROM_DIALOG.LOAD_CONFIG && isLoadConfig) ||
            ((dialogFrom === FROM_DIALOG.SAVE_CONFIG || dialogFrom === FROM_DIALOG.HEADER_CROSS) && isSaveConfigLoading)
        );
    })();

    // Load and save config dialog will be closed once data is available. So closeDialog is taken care in LoadConfiguration.ts file.
    const primaryButtonClick = () => {
        callback();
        if (
            dialogFrom !== FROM_DIALOG.LOAD_CONFIG &&
            dialogFrom !== FROM_DIALOG.SAVE_CONFIG &&
            dialogFrom !== FROM_DIALOG.HEADER_CROSS
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
                saveConfigName === '') ||
            (dialogFrom === FROM_DIALOG.LOAD_CONFIG && (!configData || configData.length === 0))
        );
    };

    return (
        <DialogLayout>
            <DialogHeader>{header}</DialogHeader>
            <DialogContent>{content}</DialogContent>
            <DialogFooter>
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
