import { Button, DialogContent, DialogFooter, DialogHeader, DialogLayout, useDialog } from '@netapp/design-system';
import { ReactNode } from 'react';
import { useAppSelector } from '../../store/storeHooks';
import { navigateToCanvas } from '../../utils/appConfig';
import { FROM_DIALOG } from '../../utils/consts';

type DialogProps = {
    header: string;
    content: ReactNode | string;
    primaryButton: string;
    secondaryButton?: string;
    callback?: any;
    closeCallback?: any;
    dialogFrom?: string;
};

const DialogComponent = ({ header, content, primaryButton, secondaryButton, callback, closeCallback, dialogFrom }: DialogProps) => {
    const { closeDialog } = useDialog();

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const saveConfigName = useAppSelector(state => state.mssqlForm.saveConfigName);

    const primaryButtonClick = () => {
        callback();
        if(dialogFrom !== FROM_DIALOG.LOAD_CONFIG){
            closeDialog();
        }
    }

    const secButtonClick = () => {
        closeCallback();
        closeDialog(null);
        if(dialogFrom === FROM_DIALOG.HEADER_CROSS) {
            navigateToCanvas('/');
        }
    }

    return (
        <DialogLayout>
            <DialogHeader>{header}</DialogHeader>
            <DialogContent>{content}</DialogContent>
            <DialogFooter>
                <Button
                    variant={'primary'}
                    className={'continue-button'}
                    isThin={true}
                    isDisabled={(dialogFrom === FROM_DIALOG.SAVE_CONFIG || 
                        dialogFrom === FROM_DIALOG.HEADER_CROSS) && saveConfigName === ''}
                    isLoading={dialogFrom === FROM_DIALOG.LOAD_CONFIG && isLoadConfig}
                    onClick={primaryButtonClick}
                >
                    {primaryButton}
                </Button>
                {secondaryButton && (
                    <Button
                        variant={'secondary'}
                        isThin={true}
                        onClick={secButtonClick}
                    >
                        {secondaryButton}
                    </Button>
                )}
            </DialogFooter>
        </DialogLayout>
    );
};

export default DialogComponent;
