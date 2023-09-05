import { Button, DialogContent, DialogFooter, DialogHeader, DialogLayout, useDialog } from '@netapp/design-system';
import { ReactNode } from 'react';
import { useAppSelector } from '../../store/storeHooks';

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

    return (
        <DialogLayout>
            <DialogHeader>{header}</DialogHeader>
            <DialogContent>{content}</DialogContent>
            <DialogFooter>
                <Button
                    variant={'primary'}
                    className={'continue-button'}
                    isThin={true}
                    isLoading={dialogFrom === 'config' && isLoadConfig}
                    onClick={() => {
                        callback();
                        if(dialogFrom !== 'config'){
                            closeDialog();
                        }
                    }}
                >
                    {primaryButton}
                </Button>
                {secondaryButton && (
                    <Button
                        variant={'secondary'}
                        isThin={true}
                        onClick={() => {
                            closeCallback();
                            closeDialog(null);
                        }}
                    >
                        {secondaryButton}
                    </Button>
                )}
            </DialogFooter>
        </DialogLayout>
    );
};

export default DialogComponent;
